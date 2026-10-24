import { z } from 'zod';
import { AppError } from '../middleware/error.middleware';

export const GranularityEnum = z.enum(['day', 'week', 'month'], {
  errorMap: () => ({ message: 'Invalid granularity. Allowed values: day, week, month' }),
});

export type Granularity = z.infer<typeof GranularityEnum>;

export const DateRangeQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const RevenueTrendQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  granularity: GranularityEnum.optional().default('day'),
});

export const TopProductsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int('Limit must be an integer').min(1, 'Limit must be at least 1').max(50, 'Limit cannot exceed 50').optional().default(10),
});

export const CustomerGrowthQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  granularity: GranularityEnum.optional().default('day'),
});

/**
 * Parses and validates date range parameters.
 * Defaults to trailing 30 days when omitted.
 * Normalizes YYYY-MM-DD strings to start/end of day UTC.
 * Ensures from <= to.
 */
export function validateDateRange(fromStr?: string, toStr?: string): { from: Date; to: Date } {
  let to: Date;
  if (toStr && toStr.trim()) {
    const rawTo = toStr.trim();
    to = new Date(rawTo);
    if (isNaN(to.getTime())) {
      throw new AppError('Invalid "to" date format', 400);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawTo)) {
      to = new Date(`${rawTo}T23:59:59.999Z`);
    }
  } else {
    to = new Date();
  }

  let from: Date;
  if (fromStr && fromStr.trim()) {
    const rawFrom = fromStr.trim();
    from = new Date(rawFrom);
    if (isNaN(from.getTime())) {
      throw new AppError('Invalid "from" date format', 400);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawFrom)) {
      from = new Date(`${rawFrom}T00:00:00.000Z`);
    }
  } else {
    from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    from.setUTCHours(0, 0, 0, 0);
  }

  if (from > to) {
    throw new AppError('from must be ≤ to', 400);
  }

  return { from, to };
}
