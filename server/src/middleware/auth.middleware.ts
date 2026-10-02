import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from './error.middleware';

// Extend Express Request to include the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

/**
 * Verify JWT from the httpOnly 'slt' cookie and attach user to req.user.
 * Exported as both `protect` (legacy) and `requireAuth` (canonical P19+).
 */
export const protect = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  let token = req.cookies?.slt;
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new AppError('Not authenticated — please log in', 401);
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, secret) as jwt.JwtPayload;
  } catch {
    throw new AppError('Invalid or expired token — please log in again', 401);
  }

  const user = await User.findById(decoded.sub);
  if (!user) {
    throw new AppError('User belonging to this token no longer exists', 401);
  }

  if (!user.active) {
    throw new AppError('Account is deactivated', 403);
  }

  req.user = user;
  next();
});

/** Canonical alias — use this on all new routes from P19 forward */
export const requireAuth = protect;



/**
 * Restrict access to specific roles. Must be used after `protect`/`requireAuth`.
 * Canonical alias: use `requireRole` from rbac.middleware on new routes.
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError('You do not have permission to perform this action', 403);
    }
    next();
  };
};

/**
 * Optional authentication: attaches req.user if a valid 'slt' token is provided,
 * but does NOT fail or throw if the token is missing or invalid.
 */
export const optionalAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.slt;
  if (!token) {
    return next();
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) return next();

  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
    if (decoded?.sub) {
      const user = await User.findById(decoded.sub);
      if (user && user.active) {
        req.user = user;
      }
    }
  } catch {
    // Ignore invalid/expired token on optional auth
  }

  next();
});

