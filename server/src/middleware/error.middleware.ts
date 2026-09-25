import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  errors?: any;

  constructor(message: string, statusCode: number, errors?: any) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const notFound = (req: Request, _res: Response, next: NextFunction): void => {
  const error = new AppError(`Not Found - ${req.originalUrl}`, 404);
  next(error);
};

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Handle Mongo duplicate key error (code 11000)
  if (err.code === 11000) {
    const keyPattern = err.keyPattern || {};
    const keyValue = err.keyValue || {};

    if (keyPattern['variants.sku'] !== undefined || ('sku' in keyValue) || ('variants.sku' in keyValue)) {
      const conflictingSku = keyValue['variants.sku'] || keyValue.sku || Object.values(keyValue)[0] || 'unknown';
      res.status(409).json({
        success: false,
        message: `SKU '${conflictingSku}' is already in use by another product variant.`,
        errors: { sku: conflictingSku },
      });
      return;
    }

    // Generic unique key collision
    const field = Object.keys(keyValue)[0] || 'field';
    res.status(409).json({
      success: false,
      message: `Duplicate value entered for ${field}: '${keyValue[field]}'.`,
      errors: keyValue,
    });
    return;
  }

  const statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode || 500);
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(err.errors ? { errors: err.errors } : {}),
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
};
