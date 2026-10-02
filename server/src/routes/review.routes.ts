import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { ROLES } from '../config/roles';
import {
  checkEligibility,
  createReview,
  getProductReviews,
  voteReview,
  getAdminReviews,
  getAdminReviewAnalytics,
  replyToReview,
  updateReviewStatus,
  deleteReview,
} from '../controllers/review.controller';

const router = Router();

// ── Public & Customer Endpoints ────────────────────────────────────────────────
router.get('/product/:productId', optionalAuth, getProductReviews);
router.get('/product/:productId/eligibility', requireAuth, checkEligibility);
router.post('/product/:productId', requireAuth, createReview);
router.patch('/:id/vote', requireAuth, voteReview);

// ── Admin Moderation Endpoints ────────────────────────────────────────────────
router.get(
  '/admin/analytics',
  requireAuth,
  requireRole(...ROLES.STAFF_AND_ABOVE),
  getAdminReviewAnalytics
);
router.get(
  '/admin',
  requireAuth,
  requireRole(...ROLES.STAFF_AND_ABOVE),
  getAdminReviews
);
router.post(
  '/admin/:id/reply',
  requireAuth,
  requireRole(...ROLES.STAFF_AND_ABOVE),
  replyToReview
);
router.patch(
  '/admin/:id/status',
  requireAuth,
  requireRole(...ROLES.STAFF_AND_ABOVE),
  updateReviewStatus
);
router.delete(
  '/admin/:id',
  requireAuth,
  requireRole(...ROLES.ADMIN_AND_ABOVE),
  deleteReview
);

export default router;
