import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { reviewPayment } from '../controllers/payment.controller';
import { noStore } from '../middleware/noStore';

const router = Router();

// Payment endpoints must never be stored in browser or proxy caches
router.use(noStore);

/**
 * @desc    Review a payment slip (approve or reject with note)
 * @route   PATCH /api/payments/:paymentId/review
 * @access  Private (staff, admin, owner)
 */
router.patch(
  '/:paymentId/review',
  requireAuth,
  requireRole('staff', 'admin', 'owner'),
  reviewPayment
);

export default router;
