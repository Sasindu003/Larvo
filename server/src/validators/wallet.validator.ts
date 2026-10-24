import { z } from 'zod';

export const AdminAdjustWalletSchema = z.object({
  direction: z.enum(['credit', 'debit'], {
    required_error: 'Adjustment direction is required and must be either credit or debit',
  }),
  points: z
    .number({ required_error: 'Points value is required' })
    .int('Points must be an integer')
    .positive('Points must be greater than 0'),
  reason: z
    .string({ required_error: 'Reason is required' })
    .trim()
    .min(1, 'Reason cannot be empty')
    .max(500, 'Reason cannot exceed 500 characters'),
});

export const WalletTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const AdminWalletsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  q: z.string().trim().optional(),
});

export const UpdateConversionRateSchema = z.object({
  pointsPerRupee: z
    .coerce
    .number({ required_error: 'Points per Rupee is required' })
    .positive('Points per Rupee must be greater than 0'),
});

