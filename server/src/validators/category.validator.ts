import { z } from 'zod';

export const CreateCategorySchema = z.object({
  name: z
    .string({ required_error: 'Category name is required' })
    .min(1, 'Category name cannot be empty')
    .trim(),
  slug: z
    .string()
    .min(1, 'Slug cannot be empty')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric and hyphen-separated')
    .optional(),
  image: z
    .string({ required_error: 'Category image URL is required' })
    .min(1, 'Category image URL cannot be empty')
    .trim(),
  department: z
    .string({ required_error: 'Department is required' })
    .min(1, 'Department cannot be empty')
    .trim(),
  parent: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export const UpdateCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Category name cannot be empty')
    .trim()
    .optional(),
  slug: z
    .string()
    .min(1, 'Slug cannot be empty')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric and hyphen-separated')
    .optional(),
  image: z
    .string()
    .min(1, 'Category image URL cannot be empty')
    .trim()
    .optional(),
  department: z
    .string()
    .min(1, 'Department cannot be empty')
    .trim()
    .optional(),
  parent: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
