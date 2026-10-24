import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name must be 80 characters or fewer')
    .trim(),
  email: z
    .string({ required_error: 'Email is required' })
    .email('Enter a valid email address')
    .toLowerCase(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be 72 characters or fewer'), // bcrypt limit
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
