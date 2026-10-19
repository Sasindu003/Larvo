import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { authRateLimit } from '../middleware/rateLimiters';
import {
  updateProfile,
  updatePassword,
  addAddress,
  updateAddress,
  deleteAddress,
} from '../controllers/user.controller';

const router = Router();

// All user routes require authentication
router.use(requireAuth);

router.patch('/me', updateProfile);
router.patch('/me/password', authRateLimit, updatePassword);
router.post('/me/addresses', addAddress);
router.patch('/me/addresses/:id', updateAddress);
router.delete('/me/addresses/:id', deleteAddress);

export default router;
