import { z } from 'zod';

export const UpdateTrackingSchema = z
  .object({
    trackingNumber: z
      .string({
        required_error: 'Tracking number is required',
        invalid_type_error: 'Tracking number must be a string',
      })
      .trim()
      .min(1, 'Tracking number cannot be empty')
      .max(100, 'Tracking number cannot exceed 100 characters'),
  })
  .strip();

export type UpdateTrackingInput = z.infer<typeof UpdateTrackingSchema>;
