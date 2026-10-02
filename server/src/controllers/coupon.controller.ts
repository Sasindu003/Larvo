import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { couponService } from '../services/coupon.service';
import { AppError } from '../middleware/error.middleware';
import {
  CreateCouponSchema,
  UpdateCouponSchema,
  ValidateCouponSchema,
} from '../validators/coupon.validator';

/**
 * @desc    Get paginated admin coupons list
 * @route   GET /api/admin/coupons
 * @access  Staff, Admin, Owner
 */
export const getAdminCoupons = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, q, status } = req.query;

  const result = await couponService.getCoupons({
    page: page as string,
    limit: limit as string,
    q: q as string,
    status: status as any,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Create a new coupon
 * @route   POST /api/admin/coupons
 * @access  Admin, Owner
 */
export const createAdminCoupon = asyncHandler(async (req: Request, res: Response) => {
  let parsed;
  try {
    parsed = CreateCouponSchema.parse(req.body);
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

  const coupon = await couponService.createCoupon(parsed);

  res.status(201).json({
    success: true,
    data: coupon,
    message: 'Coupon created successfully',
  });
});

/**
 * @desc    Update an existing coupon
 * @route   PATCH /api/admin/coupons/:id
 * @access  Admin, Owner
 */
export const updateAdminCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  let parsed;
  try {
    parsed = UpdateCouponSchema.parse(req.body);
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

  const coupon = await couponService.updateCoupon(id, parsed);

  res.status(200).json({
    success: true,
    data: coupon,
    message: 'Coupon updated successfully',
  });
});

/**
 * @desc    Deactivate a coupon
 * @route   PATCH /api/admin/coupons/:id/deactivate
 * @access  Admin, Owner
 */
export const deactivateAdminCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const coupon = await couponService.deactivateCoupon(id);

  res.status(200).json({
    success: true,
    data: coupon,
    message: 'Coupon deactivated successfully',
  });
});

/**
 * @desc    Validate coupon code for customer checkout
 * @route   POST /api/coupons/validate
 * @access  Authenticated (customer, staff, admin, owner)
 */
export const validateCoupon = asyncHandler(async (req: Request, res: Response) => {
  let parsed;
  try {
    parsed = ValidateCouponSchema.parse(req.body);
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

  const userId = (req as any).user?._id?.toString() || (req as any).user?.id?.toString();

  const result = await couponService.validateCoupon(
    parsed.code,
    userId,
    parsed.subtotal
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get active coupons for public promotional showcase
 * @route   GET /api/coupons/active
 * @access  Public
 */
export const getActiveCoupons = asyncHandler(async (req: Request, res: Response) => {
  const result = await couponService.getCoupons({
    status: 'active',
    limit: 6,
  });

  res.status(200).json({
    success: true,
    data: result.items,
  });
});
