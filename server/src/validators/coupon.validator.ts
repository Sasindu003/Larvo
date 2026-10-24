import { z } from 'zod';

export const CreateCouponSchema = z
  .object({
    code: z
      .string({ required_error: 'Coupon code is required' })
      .min(2, 'Coupon code must be at least 2 characters')
      .max(30, 'Coupon code must be at most 30 characters')
      .trim()
      .transform((v) => v.toUpperCase()),
    discountType: z.enum(['percentage', 'fixed'], {
      required_error: 'Discount type is required',
    }),
    discountValue: z
      .number({ required_error: 'Discount value is required' })
      .positive('Discount value must be greater than 0'),
    minOrderAmount: z
      .number()
      .min(0, 'Minimum order amount cannot be negative')
      .optional()
      .default(0),
    maxDiscountAmount: z
      .number()
      .positive('Max discount amount must be greater than 0')
      .nullable()
      .optional(),
    validFrom: z.coerce.date().optional(),
    validUntil: z.coerce.date({ required_error: 'Expiry date is required' }),
    usageLimit: z
      .number()
      .int()
      .positive('Usage limit must be at least 1')
      .nullable()
      .optional(),
    perCustomerLimit: z
      .number()
      .int()
      .positive('Per-customer limit must be at least 1')
      .nullable()
      .optional(),
    active: z.boolean().optional().default(true),
  })
  .refine(
    (data) => {
      if (data.discountType === 'percentage' && data.discountValue > 100) {
        return false;
      }
      return true;
    },
    {
      message: 'Percentage discount cannot exceed 100%',
      path: ['discountValue'],
    }
  );

export const UpdateCouponSchema = z
  .object({
    code: z
      .string()
      .min(2, 'Coupon code must be at least 2 characters')
      .max(30, 'Coupon code must be at most 30 characters')
      .trim()
      .transform((v) => v.toUpperCase())
      .optional(),
    discountType: z.enum(['percentage', 'fixed']).optional(),
    discountValue: z
      .number()
      .positive('Discount value must be greater than 0')
      .optional(),
    minOrderAmount: z
      .number()
      .min(0, 'Minimum order amount cannot be negative')
      .optional(),
    maxDiscountAmount: z.number().positive().nullable().optional(),
    validFrom: z.coerce.date().optional(),
    validUntil: z.coerce.date().optional(),
    usageLimit: z.number().int().positive().nullable().optional(),
    perCustomerLimit: z.number().int().positive().nullable().optional(),
    active: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (
        data.discountType === 'percentage' &&
        data.discountValue !== undefined &&
        data.discountValue > 100
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'Percentage discount cannot exceed 100%',
      path: ['discountValue'],
    }
  );

export type CreateCouponInput = z.infer<typeof CreateCouponSchema>;
export type UpdateCouponInput = z.infer<typeof UpdateCouponSchema>;

export const ValidateCouponSchema = z.object({
  code: z.string({ required_error: 'Coupon code is required' }).min(1),
  subtotal: z
    .number({ required_error: 'Subtotal is required', invalid_type_error: 'Subtotal must be a number' })
    .positive('Subtotal must be greater than 0'),
});

export type ValidateCouponInput = z.infer<typeof ValidateCouponSchema>;
