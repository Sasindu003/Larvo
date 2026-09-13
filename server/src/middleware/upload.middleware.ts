import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';

// Production Note: Swap diskStorage for cloud bucket (S3/GCS/Azure Blob) storage engine in production.
// Vercel serverless functions have a read-only filesystem except for /tmp.
const isVercel = Boolean(process.env.VERCEL);
let uploadDir = isVercel
  ? path.join('/tmp', 'uploads', 'payment-slips')
  : path.resolve(__dirname, '../../uploads/payment-slips');

try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (error) {
  // If local mkdir fails (e.g. read-only filesystem), fallback to /tmp
  try {
    uploadDir = path.join('/tmp', 'uploads', 'payment-slips');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  } catch (fallbackError) {
    console.warn('Upload directory creation failed:', (fallbackError as Error).message);
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${sanitizedOriginalName}`);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Only image (JPEG, PNG, WebP, GIF) and PDF files are allowed', 400));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter,
});

export const uploadSlip = upload.single('slip');

export const handleMulterError = (
  err: any,
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('File size exceeds the 5MB limit', 413));
    }
    return next(new AppError(err.message, 400));
  }
  if (err) {
    return next(err);
  }
  next();
};
