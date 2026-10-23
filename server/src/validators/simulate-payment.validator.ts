import { z } from 'zod';

export const ALLOWED_SIMULATE_TOKENS = ['tok_test_success', 'tok_test_decline'] as const;
export type AllowedSimulateToken = (typeof ALLOWED_SIMULATE_TOKENS)[number];

export const SimulatePaymentSchema = z
  .object({
    token: z.enum(ALLOWED_SIMULATE_TOKENS, {
      required_error: 'Test scenario token is required',
      invalid_type_error: 'Invalid test scenario token',
    }),
  })
  .strict();

export type SimulatePaymentInput = z.infer<typeof SimulatePaymentSchema>;
