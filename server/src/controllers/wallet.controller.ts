import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ZodError } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { walletService } from '../services/wallet.service';
import { AppError } from '../middleware/error.middleware';
import {
  AdminAdjustWalletSchema,
  WalletTransactionsQuerySchema,
  AdminWalletsQuerySchema,
} from '../validators/wallet.validator';

/**
 * @desc    Get current authenticated user's wallet
 * @route   GET /api/wallet/me
 * @access  Private (customer, staff, admin, owner)
 */
export const getMyWallet = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  const wallet = await walletService.getUserWallet(req.user._id);

  res.status(200).json({
    success: true,
    data: wallet,
  });
});

/**
 * @desc    Get current authenticated user's points ledger transactions
 * @route   GET /api/wallet/me/transactions
 * @access  Private (customer, staff, admin, owner)
 */
export const getMyTransactions = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  let queryParams;
  try {
    queryParams = WalletTransactionsQuerySchema.parse(req.query);
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Validation failed', 422, errors);
    }
    throw err;
  }

  const result = await walletService.getUserTransactions(req.user._id, queryParams);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Admin: Get paginated wallets
 * @route   GET /api/admin/wallets
 * @access  Private (admin, owner)
 */
export const getAdminWallets = asyncHandler(async (req: Request, res: Response) => {
  let queryParams;
  try {
    queryParams = AdminWalletsQuerySchema.parse(req.query);
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Validation failed', 422, errors);
    }
    throw err;
  }

  const result = await walletService.getAdminWallets(queryParams);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Admin: Get specific user's wallet
 * @route   GET /api/admin/wallets/:userId
 * @access  Private (admin, owner)
 */
export const getAdminWalletByUser = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!Types.ObjectId.isValid(userId)) {
    throw new AppError('Invalid user ID', 400);
  }

  const wallet = await walletService.getAdminWalletByUser(userId);

  res.status(200).json({
    success: true,
    data: wallet,
  });
});

/**
 * @desc    Admin: Get specific user's points ledger transactions
 * @route   GET /api/admin/wallets/:userId/transactions
 * @access  Private (admin, owner)
 */
export const getAdminWalletTransactions = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!Types.ObjectId.isValid(userId)) {
    throw new AppError('Invalid user ID', 400);
  }

  let queryParams;
  try {
    queryParams = WalletTransactionsQuerySchema.parse(req.query);
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Validation failed', 422, errors);
    }
    throw err;
  }

  const result = await walletService.getUserTransactions(userId, queryParams);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Admin: Adjust user wallet balance (credit or debit)
 * @route   POST /api/admin/wallets/:userId/adjust
 * @access  Private (admin, owner)
 */
export const adminAdjustWallet = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!Types.ObjectId.isValid(userId)) {
    throw new AppError('Invalid user ID', 400);
  }

  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  let body;
  try {
    body = AdminAdjustWalletSchema.parse(req.body);
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Validation failed', 422, errors);
    }
    throw err;
  }

  const result = await walletService.adminAdjustWallet({
    userId,
    adminUserId: req.user._id,
    direction: body.direction,
    points: body.points,
    reason: body.reason,
  });

  res.status(200).json({
    success: true,
    data: result,
    message: 'Wallet balance adjusted successfully',
  });
});
