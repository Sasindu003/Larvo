import { z } from 'zod';

export const CreateDepartmentSchema = z.object({
  name: z
    .string({ required_error: 'Department name is required' })
    .min(1, 'Department name cannot be empty')
    .trim(),
  slug: z
    .string()
    .min(1, 'Slug cannot be empty')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric and hyphen-separated')
    .optional(),
  image: z
    .string({ required_error: 'Department image URL is required' })
    .min(1, 'Department image URL cannot be empty')
    .trim(),
  active: z.boolean().optional(),
});

export const UpdateDepartmentSchema = z.object({
  name: z
    .string()
    .min(1, 'Department name cannot be empty')
    .trim()
    .optional(),
  slug: z
    .string()
    .min(1, 'Slug cannot be empty')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric and hyphen-separated')
    .optional(),
  image: z
    .string()
    .min(1, 'Department image URL cannot be empty')
    .trim()
    .optional(),
  active: z.boolean().optional(),
});

export type CreateDepartmentInput = z.infer<typeof CreateDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof UpdateDepartmentSchema>;
