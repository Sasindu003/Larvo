import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validateCoupon, getActiveCoupons } from '../controllers/coupon.controller';

const router = Router();

/**
 * @desc    Get active coupons for home page promo banner
 * @route   GET /api/coupons/active
 * @access  Public
 */
router.get('/active', getActiveCoupons);

/**
 * @desc    Validate coupon code for customer checkout
 * @route   POST /api/coupons/validate
 * @access  Private (any authenticated user)
 */
router.post('/validate', requireAuth, validateCoupon);

export default router;
