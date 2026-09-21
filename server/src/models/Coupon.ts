import mongoose, { Document, Schema } from 'mongoose';

export type DiscountType = 'percentage' | 'fixed';

export interface ICoupon extends Document {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  validFrom: Date;
  validUntil: Date;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  usedCount: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      set: (val: string) => (val ? val.trim().toUpperCase() : val),
    },
    discountType: {
      type: String,
      enum: {
        values: ['percentage', 'fixed'],
        message: 'Discount type must be either percentage or fixed',
      },
      required: [true, 'Discount type is required'],
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Discount value must be greater than or equal to 0'],
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: [0, 'Minimum order amount cannot be negative'],
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
    },
    validFrom: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
      required: [true, 'Expiry date (validUntil) is required'],
    },
    usageLimit: {
      type: Number,
      default: null,
    },
    perCustomerLimit: {
      type: Number,
      default: null,
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

couponSchema.index({ active: 1, validUntil: 1 });

export const Coupon = mongoose.model<ICoupon>('Coupon', couponSchema);
export default Coupon;
