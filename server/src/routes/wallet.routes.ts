import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  getMyWallet,
  getMyTransactions,
  getConversionRate,
} from '../controllers/wallet.controller';

const router = Router();

/**
 * @desc    Get points conversion value per Rs. 1
 * @route   GET /api/wallet/rate
 * @access  Public
 */
router.get('/rate', getConversionRate);

/**
 * @desc    Get current customer's wallet balance
 * @route   GET /api/wallet/me
 * @access  Private (authenticated user)
 */
router.get('/me', requireAuth, getMyWallet);

/**
 * @desc    Get current customer's points ledger transactions
 * @route   GET /api/wallet/me/transactions
 * @access  Private (authenticated user)
 */
router.get('/me/transactions', requireAuth, getMyTransactions);

export default router;

