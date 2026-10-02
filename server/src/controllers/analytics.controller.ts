import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/error.middleware';
import { analyticsService } from '../services/analytics.service';
import {
  DateRangeQuerySchema,
  RevenueTrendQuerySchema,
  TopProductsQuerySchema,
  CustomerGrowthQuerySchema,
  validateDateRange,
} from '../validators/analytics.validator';

/**
 * Helper to extract and format Zod errors into an AppError with 400 status.
 */
function handleZodError(err: unknown): never {
  if (err instanceof ZodError) {
    const message = err.errors.map((e) => e.message).join(', ');
    throw new AppError(message, 400, err.errors);
  }
  throw err;
}

/**
 * @desc    Get order summary (order count, total revenue, average order value)
 * @route   GET /api/admin/analytics/summary
 * @access  Private (admin, owner)
 */
export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  let queryParams;
  try {
    queryParams = DateRangeQuerySchema.parse(req.query);
  } catch (err) {
    handleZodError(err);
  }

  const { from, to } = validateDateRange(queryParams.from, queryParams.to);
  const data = await analyticsService.getSummary(from, to);

  res.status(200).json({
    success: true,
    data,
  });
});

/**
 * @desc    Get revenue trend over time by day, week, or month
 * @route   GET /api/admin/analytics/revenue-trend
 * @access  Private (admin, owner)
 */
export const getRevenueTrend = asyncHandler(async (req: Request, res: Response) => {
  let queryParams;
  try {
    queryParams = RevenueTrendQuerySchema.parse(req.query);
  } catch (err) {
    handleZodError(err);
  }

  const { from, to } = validateDateRange(queryParams.from, queryParams.to);
  const data = await analyticsService.getRevenueTrend(from, to, queryParams.granularity);

  res.status(200).json({
    success: true,
    data,
  });
});

/**
 * @desc    Get top selling products by revenue
 * @route   GET /api/admin/analytics/top-products
 * @access  Private (admin, owner)
 */
export const getTopProducts = asyncHandler(async (req: Request, res: Response) => {
  let queryParams;
  try {
    queryParams = TopProductsQuerySchema.parse(req.query);
  } catch (err) {
    handleZodError(err);
  }

  const { from, to } = validateDateRange(queryParams.from, queryParams.to);
  const data = await analyticsService.getTopProducts(from, to, queryParams.limit);

  res.status(200).json({
    success: true,
    data,
  });
});

/**
 * @desc    Get inventory alerts for low stock and out of stock variants
 * @route   GET /api/admin/analytics/inventory-alerts
 * @access  Private (admin, owner)
 */
export const getInventoryAlerts = asyncHandler(async (_req: Request, res: Response) => {
  const data = await analyticsService.getInventoryAlerts();

  res.status(200).json({
    success: true,
    data,
  });
});

/**
 * @desc    Get customer registration growth over time
 * @route   GET /api/admin/analytics/customer-growth
 * @access  Private (admin, owner)
 */
export const getCustomerGrowth = asyncHandler(async (req: Request, res: Response) => {
  let queryParams;
  try {
    queryParams = CustomerGrowthQuerySchema.parse(req.query);
  } catch (err) {
    handleZodError(err);
  }

  const { from, to } = validateDateRange(queryParams.from, queryParams.to);
  const data = await analyticsService.getCustomerGrowth(from, to, queryParams.granularity);

  res.status(200).json({
    success: true,
    data,
  });
});

/**
 * @desc    Get reward points and wallet summary metrics
 * @route   GET /api/admin/analytics/wallet-summary
 * @access  Private (admin, owner)
 */
export const getWalletSummary = asyncHandler(async (_req: Request, res: Response) => {
  const data = await analyticsService.getWalletSummary();

  res.status(200).json({
    success: true,
    data,
  });
});
