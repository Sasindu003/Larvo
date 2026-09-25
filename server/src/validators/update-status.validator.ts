import { z } from 'zod';

export const UpdateOrderStatusSchema = z
  .object({
    status: z.enum(
      [
        'pending_payment',
        'payment_review',
        'confirmed',
        'processing',
        'ready_for_dispatch',
        'picked_up',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'cancelled',
      ],
      {
        required_error: 'Target order status is required',
        invalid_type_error: 'Invalid order status value',
      }
    ),
    trackingNumber: z
      .string()
      .trim()
      .max(100, 'Tracking number cannot exceed 100 characters')
      .optional()
      .nullable(),
  })
  .strip();

export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;
