import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { getFileMetadata, getFileFromGridFS, uploadToGridFS } from '../services/gridfs.service';
import { uploadFiles, handleMulterError } from '../middleware/upload.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { env } from '../config/env';
import User, { IUser } from '../models/User';
import { Order } from '../models/Order';

const router = Router();

/**
 * Resolves authenticated user from JWT in httpOnly cookie or Authorization header.
 * Runs non-blocking / inline without throwing so public files stay unauthenticated.
 */
const resolveUserFromRequest = async (req: Request): Promise<IUser | null> => {
  let token = req.cookies?.slt;
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token || !env.JWT_SECRET) return null;
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (!decoded?.sub) return null;
    const user = await User.findById(decoded.sub);
    if (!user || !user.active) return null;
    return user;
  } catch {
    return null;
  }
};

const handleFileStream = async (fileIdentifier: string, req: Request, res: Response): Promise<void> => {
  try {
    const fileMeta = await getFileMetadata(fileIdentifier);

    if (!fileMeta) {
      res.status(404).json({
        success: false,
        message: 'File not found in MongoDB storage',
      });
      return;
    }

    const isPaymentSlip =
      fileMeta.metadata?.type === 'payment_slip' ||
      req.baseUrl.includes('payment-slips') ||
      req.path.startsWith('/payment-slips');

    if (isPaymentSlip) {
      // 1. Authenticate user for payment slip
      const user = req.user || (await resolveUserFromRequest(req));
      if (!user) {
        // Return 404 so file existence is not revealed
        res.status(404).json({
          success: false,
          message: 'File not found in MongoDB storage',
        });
        return;
      }

      // 2. Authorize: Staff/Admin/Owner or Order Owner
      const isStaffOrAdmin = ['staff', 'admin', 'owner'].includes(user.role);
      let isOwner = false;

      if (!isStaffOrAdmin) {
        const orderId = fileMeta.metadata?.orderId;
        if (orderId && mongoose.Types.ObjectId.isValid(orderId)) {
          const order = await Order.findById(orderId).select('user');
          if (order && order.user.toString() === user._id.toString()) {
            isOwner = true;
          }
        }
        if (!isOwner && fileMeta.metadata?.uploadedBy === user._id.toString()) {
          isOwner = true;
        }
      }

      if (!isStaffOrAdmin && !isOwner) {
        // Return 404 to avoid leaking existence
        res.status(404).json({
          success: false,
          message: 'File not found in MongoDB storage',
        });
        return;
      }

      // 3. Set private, no-store headers for slips (no ETag, no public immutable, same-origin only)
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Content-Type', fileMeta.contentType);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(fileMeta.filename)}"`
      );

      const fileData = await getFileFromGridFS(fileIdentifier);
      if (!fileData) {
        res.status(404).json({ success: false, message: 'File not found in MongoDB storage' });
        return;
      }

      fileData.stream.on('error', (_err) => {
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: 'Error streaming file' });
        }
      });

      fileData.stream.pipe(res);
      return;
    }

    // Public file stream (product images, return photos, category banners)
    const etag = `"${fileMeta.fileId || fileIdentifier}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    res.setHeader('Content-Type', fileMeta.contentType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(fileMeta.filename)}"`
    );

    const fileData = await getFileFromGridFS(fileIdentifier);
    if (!fileData) {
      res.status(404).json({ success: false, message: 'File not found in MongoDB storage' });
      return;
    }

    fileData.stream.on('error', (_err) => {
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Error streaming file' });
      }
    });

    fileData.stream.pipe(res);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to retrieve file',
    });
  }
};

/**
 * @desc    Upload up to 5 files (images/PDFs) directly to MongoDB GridFS
 * @route   POST /api/files/upload
 * @access  Private
 */
router.post(
  '/upload',
  requireAuth,
  uploadFiles,
  handleMulterError,
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Disallow generic upload endpoint from creating payment_slip files
      if (req.body?.type === 'payment_slip' || req.query?.type === 'payment_slip') {
        res.status(400).json({
          success: false,
          message: 'Payment slips cannot be uploaded via generic upload endpoint',
        });
        return;
      }

      const files = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          message: 'No files uploaded',
        });
        return;
      }

      const uploadedResults = await Promise.all(
        files.map(async (file) => {
          const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
          const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${sanitizedOriginalName}`;
          return uploadToGridFS(file.buffer, uniqueFilename, file.mimetype, {
            uploadedBy: req.user?._id?.toString(),
            originalName: file.originalname,
            type: 'attachment',
          });
        })
      );

      res.status(201).json({
        success: true,
        data: {
          files: uploadedResults,
          fileIds: uploadedResults.map((f) => f.fileId),
          urls: uploadedResults.map((f) => f.url),
        },
        message: 'Files uploaded successfully to MongoDB GridFS',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to upload files',
      });
    }
  }
);

/**
 * @desc    Stream file from MongoDB GridFS by ID or filename
 * @route   GET /api/files/:id
 * @access  Public for products/categories; Private 404 for payment slips
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  await handleFileStream(req.params.id, req, res);
});

/**
 * @desc    Stream payment slip from MongoDB GridFS
 * @route   GET /api/files/payment-slips/:id
 * @access  Private (Order owner, staff, admin, owner)
 */
router.get('/payment-slips/:id', async (req: Request, res: Response): Promise<void> => {
  await handleFileStream(req.params.id, req, res);
});

export default router;
