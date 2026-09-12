import { Coupon, ICoupon } from '../models/Coupon';
import { Order } from '../models/Order';
import { AppError } from '../middleware/error.middleware';
import { CreateCouponInput, UpdateCouponInput } from '../validators/coupon.validator';

export interface GetCouponsQuery {
  page?: number | string;
  limit?: number | string;
  q?: string;
  status?: 'all' | 'active' | 'inactive' | 'expired';
}

export interface PaginatedCoupons {
  items: ICoupon[];
  results: number;
  total: number;
  page: number;
  pages: number;
}

export interface CouponValidationResult {
  valid: boolean;
  coupon?: ICoupon;
  discountAmount?: number;
  message?: string;
}

export const couponService = {
  /**
   * Fetch paginated list of coupons with optional keyword search and status filtering
   */
  async getCoupons(query: GetCouponsQuery): Promise<PaginatedCoupons> {
    const page = Math.max(1, parseInt(String(query.page || 1), 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(String(query.limit || 15), 10) || 15));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (query.q && query.q.trim()) {
      filter.code = { $regex: query.q.trim().toUpperCase(), $options: 'i' };
    }

    const now = new Date();
    if (query.status === 'active') {
      filter.active = true;
      filter.validUntil = { $gte: now };
    } else if (query.status === 'inactive') {
      filter.active = false;
    } else if (query.status === 'expired') {
      filter.validUntil = { $lt: now };
    }

    const [total, items] = await Promise.all([
      Coupon.countDocuments(filter),
      Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ]);

    const pages = Math.ceil(total / limit) || 1;

    return {
      items,
      results: items.length,
      total,
      page,
      pages,
    };
  },

  /**
   * Get coupon by ID
   */
  async getCouponById(id: string): Promise<ICoupon> {
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      throw new AppError(`Coupon not found`, 404);
    }
    return coupon;
  },

  /**
   * Create a new coupon (case-insensitive code uniqueness enforced)
   */
  async createCoupon(input: CreateCouponInput): Promise<ICoupon> {
    const codeUpper = input.code.trim().toUpperCase();

    // Check code uniqueness
    const existing = await Coupon.findOne({ code: codeUpper });
    if (existing) {
      throw new AppError(`Coupon code '${codeUpper}' already exists`, 409);
    }

    const coupon = new Coupon({
      ...input,
      code: codeUpper,
    });

    await coupon.save();
    return coupon;
  },

  /**
   * Update an existing coupon
   */
  async updateCoupon(id: string, input: UpdateCouponInput): Promise<ICoupon> {
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      throw new AppError(`Coupon not found`, 404);
    }

    if (input.code) {
      const codeUpper = input.code.trim().toUpperCase();
      if (codeUpper !== coupon.code) {
        const existing = await Coupon.findOne({ code: codeUpper, _id: { $ne: id } });
        if (existing) {
          throw new AppError(`Coupon code '${codeUpper}' already exists`, 409);
        }
        coupon.code = codeUpper;
      }
    }

    if (input.discountType !== undefined) coupon.discountType = input.discountType;
    if (input.discountValue !== undefined) coupon.discountValue = input.discountValue;
    if (input.minOrderAmount !== undefined) coupon.minOrderAmount = input.minOrderAmount;
    if (input.maxDiscountAmount !== undefined) coupon.maxDiscountAmount = input.maxDiscountAmount;
    if (input.validFrom !== undefined) coupon.validFrom = input.validFrom;
    if (input.validUntil !== undefined) coupon.validUntil = input.validUntil;
    if (input.usageLimit !== undefined) coupon.usageLimit = input.usageLimit;
    if (input.perCustomerLimit !== undefined) coupon.perCustomerLimit = input.perCustomerLimit;
    if (input.active !== undefined) coupon.active = input.active;

    await coupon.save();
    return coupon;
  },

  /**
   * Deactivate a coupon
   */
  async deactivateCoupon(id: string): Promise<ICoupon> {
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      throw new AppError(`Coupon not found`, 404);
    }

    coupon.active = false;
    await coupon.save();
    return coupon;
  },

  /**
   * Compute discount amount based on coupon rules and subtotal
   */
  computeDiscount(coupon: ICoupon, subtotal: number): number {
    let raw = 0;
    if (coupon.discountType === 'percentage') {
      raw = (subtotal * coupon.discountValue) / 100;
    } else if (coupon.discountType === 'fixed') {
      raw = coupon.discountValue;
    }

    if (coupon.maxDiscountAmount != null && coupon.maxDiscountAmount > 0) {
      raw = Math.min(raw, coupon.maxDiscountAmount);
    }

    const clamped = Math.min(Math.max(0, raw), subtotal);
    return Math.round(clamped * 100) / 100;
  },

  /**
   * Validate coupon eligibility for a user and order subtotal
   */
  async validateCoupon(
    code: string,
    userId?: string,
    subtotal: number = 0
  ): Promise<CouponValidationResult> {
    const codeUpper = (code || '').trim().toUpperCase();
    if (!codeUpper) {
      return { valid: false, message: 'Coupon code is required' };
    }

    const coupon = await Coupon.findOne({ code: codeUpper });
    if (!coupon) {
      return { valid: false, message: 'Coupon code not found' };
    }

    if (!coupon.active) {
      return { valid: false, message: 'This coupon is inactive' };
    }

    const now = new Date();
    if (coupon.validFrom && now < new Date(coupon.validFrom)) {
      return { valid: false, message: 'This coupon is not yet active' };
    }

    if (coupon.validUntil && now > new Date(coupon.validUntil)) {
      return { valid: false, message: 'This coupon has expired' };
    }

    if (coupon.minOrderAmount != null && subtotal < coupon.minOrderAmount) {
      return {
        valid: false,
        message: `Minimum order amount of ৳${coupon.minOrderAmount} required`,
      };
    }

    if (coupon.usageLimit != null) {
      const globalUsage = await Order.countDocuments({
        couponCode: codeUpper,
        status: { $ne: 'cancelled' },
      });

      if (globalUsage >= coupon.usageLimit) {
        return {
          valid: false,
          message: 'This coupon has reached its maximum usage limit',
        };
      }
    }

    if (coupon.perCustomerLimit != null && userId) {
      const userUsage = await Order.countDocuments({
        couponCode: codeUpper,
        user: userId,
        status: { $ne: 'cancelled' },
      });

      if (userUsage >= coupon.perCustomerLimit) {
        return {
          valid: false,
          message: 'You have already used this coupon the maximum number of times',
        };
      }
    }

    const discountAmount = couponService.computeDiscount(coupon, subtotal);

    return {
      valid: true,
      coupon,
      discountAmount,
      message: 'Coupon applied successfully',
    };
  },
};

export const computeDiscount = couponService.computeDiscount;
export const validateCoupon = couponService.validateCoupon.bind(couponService);
export default couponService;
