import api, { ApiResponse } from './api';

export type DiscountType = 'percentage' | 'fixed';

export interface Coupon {
  _id: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  validFrom: string;
  validUntil: string;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  usedCount: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedCouponsResponse {
  items: Coupon[];
  results: number;
  total: number;
  page: number;
  pages: number;
}

export interface CreateCouponDto {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number | null;
  validFrom?: string;
  validUntil: string;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  active?: boolean;
}

export interface UpdateCouponDto {
  code?: string;
  discountType?: DiscountType;
  discountValue?: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number | null;
  validFrom?: string;
  validUntil?: string;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  active?: boolean;
}

export const couponService = {
  /**
   * Fetch paginated admin coupons list with search & status filter
   */
  async getAdminCoupons(params?: {
    page?: number;
    limit?: number;
    q?: string;
    status?: string;
  }): Promise<PaginatedCouponsResponse> {
    const res = await api.get<ApiResponse<PaginatedCouponsResponse>>('/admin/coupons', {
      params,
    });
    return (res as any).data || (res as any);
  },

  /**
   * Create a new coupon (Admin/Owner only)
   */
  async createCoupon(data: CreateCouponDto): Promise<Coupon> {
    const res = await api.post<ApiResponse<Coupon>>('/admin/coupons', data);
    return (res as any).data || (res as any);
  },

  /**
   * Update an existing coupon (Admin/Owner only)
   */
  async updateCoupon(id: string, data: UpdateCouponDto): Promise<Coupon> {
    const res = await api.patch<ApiResponse<Coupon>>(`/admin/coupons/${id}`, data);
    return (res as any).data || (res as any);
  },

  /**
   * Deactivate a coupon (Admin/Owner only)
   */
  async deactivateCoupon(id: string): Promise<Coupon> {
    const res = await api.patch<ApiResponse<Coupon>>(`/admin/coupons/${id}/deactivate`);
    return (res as any).data || (res as any);
  },

  /**
   * Validate a coupon code for checkout with live cart subtotal
   */
  async validateCoupon(code: string, subtotal: number): Promise<CouponValidationResponse> {
    const res = await api.post<ApiResponse<CouponValidationResponse>>('/coupons/validate', {
      code,
      subtotal,
    });
    return (res as any).data || (res as any);
  },

  /**
   * Get active public coupons for promotion banners
   */
  async getActiveCoupons(): Promise<Coupon[]> {
    const res = await api.get<ApiResponse<Coupon[]>>('/coupons/active');
    return (res as any).data || (res as any);
  },
};

export interface CouponValidationResponse {
  valid: boolean;
  coupon?: Coupon;
  discountAmount?: number;
  message?: string;
}

export default couponService;
