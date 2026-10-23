import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that instructs browsers and shared intermediate caches
 * never to cache or store sensitive financial, order, payment or invoice responses.
 */
export const noStore = (_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

export default noStore;
