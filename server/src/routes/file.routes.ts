import { Router, Request, Response } from 'express';
import { getFileFromGridFS, uploadToGridFS } from '../services/gridfs.service';
import { uploadFiles, handleMulterError } from '../middleware/upload.middleware';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

const handleFileStream = async (fileIdentifier: string, res: Response): Promise<void> => {
  try {
    const fileData = await getFileFromGridFS(fileIdentifier);

    if (!fileData) {
      res.status(404).json({
        success: false,
        message: 'File not found in MongoDB storage',
      });
      return;
    }

    res.setHeader('Content-Type', fileData.contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(fileData.filename)}"`
    );

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
 * @access  Public
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  await handleFileStream(req.params.id, res);
});

router.get('/payment-slips/:id', async (req: Request, res: Response): Promise<void> => {
  await handleFileStream(req.params.id, res);
});

export default router;
