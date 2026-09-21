import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps async controller functions to catch unhandled rejections and forward to next(err)
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
