import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const ReturnItemInputSchema = z.object({
  orderItemRef: z
    .coerce
    .number({ required_error: 'Item reference is required' })
    .int('Item reference must be an integer')
    .gte(0, 'Item reference must be non-negative'),
  qty: z
    .coerce
    .number({ required_error: 'Quantity is required' })
    .int('Quantity must be an integer')
    .gte(1, 'Quantity must be at least 1'),
  reason: z
    .string({ required_error: 'Reason is required' })
    .trim()
    .min(5, 'Reason must be at least 5 characters')
    .max(500, 'Reason cannot exceed 500 characters'),
});

export const CreateReturnRequestSchema = z
  .object({
    orderId: z
      .string({ required_error: 'Order ID is required' })
      .regex(objectIdRegex, 'Invalid order ID format'),
    items: z
      .array(ReturnItemInputSchema, { required_error: 'Items are required' })
      .min(1, 'At least one item must be selected for return'),
  })
  .strip();

export type CreateReturnRequestInput = z.infer<typeof CreateReturnRequestSchema>;

export const GetMyReturnsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  orderId: z.string().regex(objectIdRegex, 'Invalid order ID format').optional(),
});

export const GetAdminReturnsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z
    .enum([
      'requested',
      'under_review',
      'approved',
      'rejected',
      'pickup_scheduled',
      'picked_up',
      'received',
      'refunded',
    ])
    .optional(),
  userId: z.string().regex(objectIdRegex, 'Invalid user ID format').optional(),
});

export type GetAdminReturnsQuery = z.infer<typeof GetAdminReturnsQuerySchema>;

export const DecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().trim().max(500).optional(),
});

export type DecisionInput = z.infer<typeof DecisionSchema>;

export const AdvanceReturnStatusSchema = z.object({
  status: z.enum(['picked_up', 'received'], {
    required_error: 'Status must be either picked_up or received',
  }),
});

export type AdvanceReturnStatusInput = z.infer<typeof AdvanceReturnStatusSchema>;

export const GetDeliveryReturnsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(['pickup_scheduled', 'picked_up']).optional(),
});

export type GetDeliveryReturnsQuery = z.infer<typeof GetDeliveryReturnsQuerySchema>;

