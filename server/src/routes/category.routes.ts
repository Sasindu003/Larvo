import { Router } from 'express';
import {
  getCategories,
  createCategory,
  updateCategory,
  deactivateCategory,
} from '../controllers/category.controller';
import { protect, optionalAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { ROLES } from '../config/roles';

const router = Router();

// Public / optional auth browse
router.get('/', optionalAuth, getCategories);

// Admin & Owner mutations
router.post(
  '/',
  protect,
  requireRole(...ROLES.ADMIN_AND_ABOVE),
  createCategory
);

router.patch(
  '/:id',
  protect,
  requireRole(...ROLES.ADMIN_AND_ABOVE),
  updateCategory
);

router.patch(
  '/:id/deactivate',
  protect,
  requireRole(...ROLES.ADMIN_AND_ABOVE),
  deactivateCategory
);

export default router;
