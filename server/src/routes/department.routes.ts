import { Router } from 'express';
import {
  getDepartments,
  getDepartmentBySlug,
  createDepartment,
  updateDepartment,
  deactivateDepartment,
} from '../controllers/department.controller';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { ROLES } from '../config/roles';

const router = Router();

// Public browse routes (optionalAuth attaches req.user if caller is logged in)
router.get('/', optionalAuth, getDepartments);
router.get('/:slug', optionalAuth, getDepartmentBySlug);

// Admin & Owner management routes
router.post(
  '/',
  requireAuth,
  requireRole(...ROLES.ADMIN_AND_ABOVE),
  createDepartment
);

router.patch(
  '/:id',
  requireAuth,
  requireRole(...ROLES.ADMIN_AND_ABOVE),
  updateDepartment
);

router.patch(
  '/:id/deactivate',
  requireAuth,
  requireRole(...ROLES.ADMIN_AND_ABOVE),
  deactivateDepartment
);

export default router;
