import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  let message = err.message || 'Internal server error';
  let code = err.code;
  let errors = err.errors;

  // 1. Zod validation errors
  if (err.name === 'ZodError') {
    statusCode = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    errors = err.errors?.map((e: any) => ({
      field: Array.isArray(e.path) ? e.path.join('.') : e.path,
      message: e.message,
    }));
  }

  // 2. Mongoose CastError (invalid ObjectId format)
  else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path || 'ID'} format: '${err.value}'`;
    code = 'INVALID_ID';
  }

  // 3. Mongoose ValidationError
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message || 'Validation error';
    code = 'VALIDATION_ERROR';
    errors = err.errors;
  }

  // 4. Mongo duplicate key error (code 11000)
  else if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_KEY';
    const keyPattern = err.keyPattern || {};
    const keyValue = err.keyValue || {};

    if (keyPattern['variants.sku'] !== undefined || ('sku' in keyValue) || ('variants.sku' in keyValue)) {
      const conflictingSku = keyValue['variants.sku'] || keyValue.sku || Object.values(keyValue)[0] || 'unknown';
      message = `SKU '${conflictingSku}' is already in use by another product variant.`;
      errors = { sku: conflictingSku };
    } else {
      const field = Object.keys(keyValue)[0] || 'field';
      message = `Duplicate value entered for ${field}: '${keyValue[field]}'.`;
      errors = keyValue;
    }
  }

  // 5. JWT errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
    code = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
    code = 'TOKEN_EXPIRED';
  }

  // 6. Multer errors
  else if (err.name === 'MulterError') {
    statusCode = 400;
    message = err.message || 'File upload error';
    code = 'UPLOAD_ERROR';
  }

  // 7. Non-operational / unknown 500 errors
  else if (!(err instanceof AppError) && statusCode === 500) {
    code = 'INTERNAL_SERVER_ERROR';
    if (env.NODE_ENV === 'production') {
      message = 'Internal server error';
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(code ? { code } : {}),
    ...(errors ? { errors } : {}),
    ...(env.NODE_ENV === 'development' && err.stack ? { stack: err.stack } : {}),
  });
};

export default errorHandler;
