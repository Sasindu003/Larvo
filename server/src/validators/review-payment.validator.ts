import { z } from 'zod';

export const ReviewPaymentSchema = z
  .object({
    decision: z.enum(['approved', 'rejected'], {
      required_error: 'Decision is required (approved or rejected)',
      invalid_type_error: 'Decision must be approved or rejected',
    }),
    note: z
      .string({ invalid_type_error: 'Note must be a string' })
      .trim()
      .max(500, 'Note cannot exceed 500 characters')
      .optional()
      .nullable(),
  })
  .refine(
    (data) => data.decision !== 'rejected' || (typeof data.note === 'string' && data.note.trim().length > 0),
    {
      message: 'A rejection note is required',
      path: ['note'],
    }
  );

export type ReviewPaymentInput = z.infer<typeof ReviewPaymentSchema>;
