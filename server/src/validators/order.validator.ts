import { z } from 'zod';
import { Types } from 'mongoose';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const OrderItemInputSchema = z.object({
  productId: z
    .string({ required_error: 'Product ID is required' })
    .regex(objectIdRegex, 'Invalid product ID format'),
  variantSku: z
    .string({ required_error: 'Variant SKU is required' })
    .min(1, 'Variant SKU cannot be empty')
    .trim(),
  quantity: z
    .number({ required_error: 'Quantity is required' })
    .int('Quantity must be an integer')
    .positive('Quantity must be greater than 0'),
});

export const CreateOrderSchema = z
  .object({
    items: z
      .array(OrderItemInputSchema, { required_error: 'Items are required' })
      .min(1, 'Order must contain at least one item'),
    shippingAddressId: z
      .string({ required_error: 'Shipping address ID is required' })
      .min(1, 'Shipping address ID cannot be empty')
      .trim(),
    couponCode: z
      .string()
      .trim()
      .max(30, 'Coupon code cannot exceed 30 characters')
      .optional()
      .nullable(),
  })
  .strip();

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
