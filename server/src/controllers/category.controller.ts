import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { categoryService } from '../services/category.service';
import { AppError } from '../middleware/error.middleware';
import { ROLES } from '../config/roles';
import { UserRole } from '../models/User';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
} from '../validators/category.validator';

/**
 * @desc    Get all categories (public active only by default; ?includeInactive=true for authorized callers)
 * @route   GET /api/categories
 * @access  Public / Admin
 */
export const getCategories = asyncHandler(async (req: Request, res: Response) => {
  const includeInactiveQuery = req.query.includeInactive === 'true';

  let includeInactive = false;
  if (includeInactiveQuery) {
    if (req.user && ROLES.ADMIN_AND_ABOVE.includes(req.user.role as UserRole)) {
      includeInactive = true;
    }
  }

  const categories = await categoryService.getAllCategories(includeInactive);
  res.status(200).json({
    success: true,
    data: categories,
  });
});

/**
 * @desc    Create a category
 * @route   POST /api/categories
 * @access  Private (Admin/Owner)
 */
export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  let parsed;
  try {
    parsed = CreateCategorySchema.parse(req.body);
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Validation failed', 422, errors);
    }
    throw err;
  }

  const category = await categoryService.createCategory(parsed);

  res.status(201).json({
    success: true,
    data: category,
    message: 'Category created successfully',
  });
});

/**
 * @desc    Update a category
 * @route   PATCH /api/categories/:id
 * @access  Private (Admin/Owner)
 */
export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  let parsed;
  try {
    parsed = UpdateCategorySchema.parse(req.body);
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Validation failed', 422, errors);
    }
    throw err;
  }

  const category = await categoryService.updateCategory(id, parsed);

  res.status(200).json({
    success: true,
    data: category,
    message: 'Category updated successfully',
  });
});

/**
 * @desc    Deactivate category
 * @route   PATCH /api/categories/:id/deactivate
 * @access  Private (Admin/Owner)
 */
export const deactivateCategory = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const category = await categoryService.deactivateCategory(id);

  res.status(200).json({
    success: true,
    data: category,
    message: 'Category deactivated successfully',
  });
});
