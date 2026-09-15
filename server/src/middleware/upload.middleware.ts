import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';

// In-memory storage buffer for streaming directly to MongoDB GridFS
const storage = multer.memoryStorage();

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
