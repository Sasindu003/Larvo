import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';
import type { UserRole } from '../models/User';

/**
 * Role-based access control guard. Must be composed after `requireAuth`.
 *
 * Usage:
 *   router.get('/admin/ping', requireAuth, requireRole('admin', 'owner'), handler);
 *
 * Exported as both `requireRole` (canonical) and `authorize` re-export alias.
 */
export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }
    if (!roles.includes(req.user.role as UserRole)) {
      throw new AppError(
        `Access denied — requires role: ${roles.join(' or ')}`,
        403
      );
    }
    next();
  };
};
