import { Coupon } from '../models/Coupon';

export const SEED_COUPONS = [
  {
    code: 'WELCOME10',
    discountType: 'percentage' as const,
    discountValue: 10,
    minOrderAmount: 2500,
    maxDiscountAmount: 1500,
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2030-12-31'),
    usageLimit: 500,
    perCustomerLimit: 1,
    active: true,
  },
  {
    code: 'FLAT500',
    discountType: 'fixed' as const,
    discountValue: 500,
    minOrderAmount: 5000,
    maxDiscountAmount: null,
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2030-12-31'),
    usageLimit: 200,
    perCustomerLimit: 1,
    active: true,
  },
  {
    code: 'AVURUDU20',
    discountType: 'percentage' as const,
    discountValue: 20,
    minOrderAmount: 8000,
    maxDiscountAmount: 3000,
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2030-12-31'),
    usageLimit: 300,
    perCustomerLimit: 2,
    active: true,
  },
  {
    code: 'FREESHIP',
    discountType: 'fixed' as const,
    discountValue: 350,
    minOrderAmount: 3500,
    maxDiscountAmount: null,
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2030-12-31'),
    usageLimit: 1000,
    perCustomerLimit: 3,
    active: true,
  },
];

export const seedCoupons = async () => {
  for (const c of SEED_COUPONS) {
    await Coupon.updateOne(
      { code: c.code },
      {
        $set: {
          code: c.code,
          discountType: c.discountType,
          discountValue: c.discountValue,
          minOrderAmount: c.minOrderAmount,
          maxDiscountAmount: c.maxDiscountAmount,
          validFrom: c.validFrom,
          validUntil: c.validUntil,
          usageLimit: c.usageLimit,
          perCustomerLimit: c.perCustomerLimit,
          active: c.active,
        },
      },
      { upsert: true }
    );
  }
};
