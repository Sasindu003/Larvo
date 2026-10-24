import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const existingId = req.headers['x-request-id'];
  const id =
    typeof existingId === 'string' && existingId.trim().length > 0
      ? existingId.trim()
      : Array.isArray(existingId) && existingId[0]
        ? existingId[0]
        : randomUUID();

  req.id = id;
  res.setHeader('x-request-id', id);
  next();
};

export default requestId;
