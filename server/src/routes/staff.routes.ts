import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import {
  getStaff,
  createStaff,
  updateStaff,
} from '../controllers/staff.controller';

const router = Router();

// All staff endpoints require authentication and admin/owner role
router.use(requireAuth);
router.use(requireRole('admin', 'owner'));

router.get('/', getStaff);
router.post('/', createStaff);
router.patch('/:id', updateStaff);

export default router;
