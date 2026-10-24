import { z } from 'zod';

export const CreateSupplierSchema = z.object({
  name: z
    .string({ required_error: 'Contact name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  companyName: z
    .string({ required_error: 'Company name is required' })
    .trim()
    .min(2, 'Company name must be at least 2 characters')
    .max(100, 'Company name cannot exceed 100 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Invalid email address')
    .max(100, 'Email cannot exceed 100 characters'),
  phone: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .regex(/^\d{10,13}$/, 'Phone number must contain only numbers and be 10 to 13 digits long'),
  address: z
    .string()
    .trim()
    .max(500, 'Address cannot exceed 500 characters')
    .optional()
    .default(''),
  notes: z
    .string()
    .trim()
    .max(1000, 'Notes cannot exceed 1000 characters')
    .optional()
    .default(''),
});

export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>;

export const UpdateSupplierSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  companyName: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email('Invalid email address').max(100).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\d{10,13}$/, 'Phone number must contain only numbers and be 10 to 13 digits long')
    .optional(),
  address: z.string().trim().max(500).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type UpdateSupplierInput = z.infer<typeof UpdateSupplierSchema>;

export const GetSuppliersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.enum(['all', 'active', 'inactive']).optional().default('all'),
});

export type GetSuppliersQuery = z.infer<typeof GetSuppliersQuerySchema>;
