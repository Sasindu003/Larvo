import { z } from 'zod';

export function luhnCheck(num: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10);
    if (isNaN(n)) return false;
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export const SimulatePaymentSchema = z
  .object({
    cardNumber: z
      .string({ required_error: 'Card number is required' })
      .transform((val) => val.replace(/[\s-]/g, ''))
      .refine((val) => /^\d{13,19}$/.test(val), {
        message: 'Card number must be 13 to 19 digits',
      })
      .refine((val) => luhnCheck(val), {
        message: 'Invalid card number (failed Luhn check)',
      }),
    expiry: z
      .string({ required_error: 'Expiry date is required' })
      .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Expiry must be in MM/YY format')
      .refine(
        (val) => {
          const [mm, yy] = val.split('/');
          const month = parseInt(mm, 10);
          const year = 2000 + parseInt(yy, 10);
          // Expiry is valid through the end of the month
          const expiryEnd = new Date(year, month, 1, 0, 0, 0);
          return expiryEnd.getTime() > Date.now();
        },
        { message: 'Card has expired' }
      ),
    cvv: z
      .string({ required_error: 'CVV is required' })
      .regex(/^\d{3,4}$/, 'CVV must be 3 or 4 digits'),
    cardholderName: z
      .string({ required_error: 'Cardholder name is required' })
      .trim()
      .min(1, 'Cardholder name is required')
      .max(64, 'Cardholder name cannot exceed 64 characters'),
  })
  .strip();

export type SimulatePaymentInput = z.infer<typeof SimulatePaymentSchema>;
