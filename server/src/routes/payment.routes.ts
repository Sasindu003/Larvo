import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { reviewPayment } from '../controllers/payment.controller';

const router = Router();

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
