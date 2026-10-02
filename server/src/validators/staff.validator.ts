import { z } from 'zod';

export const CreateStaffSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name must be 80 characters or fewer')
    .trim(),
  email: z
    .string({ required_error: 'Email is required' })
    .email('Enter a valid email address')
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: 'Temporary password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be 72 characters or fewer'),
  role: z.enum(['staff', 'delivery_manager', 'admin'], {
    required_error: 'Role is required (staff, delivery_manager, or admin)',
    invalid_type_error: 'Role must be staff, delivery_manager, or admin',
  }),
});

export const UpdateStaffSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(80, 'Name must be 80 characters or fewer')
      .trim()
      .optional(),
    active: z.boolean().optional(),
    role: z.enum(['staff', 'delivery_manager', 'admin', 'owner']).optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.active !== undefined || data.role !== undefined,
    {
      message: 'At least one field (name, active, or role) must be provided for update',
    }
  );

export const ListStaffQuerySchema = z.object({
  page: z
    .preprocess((val) => (val ? parseInt(String(val), 10) : 1), z.number().int().min(1))
    .default(1),
  limit: z
    .preprocess((val) => (val ? parseInt(String(val), 10) : 20), z.number().int().min(1).max(100))
    .default(20),
  role: z.enum(['staff', 'delivery_manager', 'admin', 'owner']).optional(),
  search: z.string().trim().optional(),
});

export type CreateStaffInput = z.infer<typeof CreateStaffSchema>;
export type UpdateStaffInput = z.infer<typeof UpdateStaffSchema>;
export type ListStaffQuery = z.infer<typeof ListStaffQuerySchema>;
