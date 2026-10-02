import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { departmentService } from '../services/department.service';
import { AppError } from '../middleware/error.middleware';
import { ROLES } from '../config/roles';
import { UserRole } from '../models/User';
import {
  CreateDepartmentSchema,
  UpdateDepartmentSchema,
} from '../validators/department.validator';

/**
 * @desc    Get all departments (public, active only by default; ?includeInactive=true for authorized callers)
 * @route   GET /api/departments
 * @access  Public (filtered) / Admin/Owner (all)
 */
export const getDepartments = asyncHandler(async (req: Request, res: Response) => {
  const includeInactiveQuery = req.query.includeInactive === 'true';

  let includeInactive = false;
  if (includeInactiveQuery) {
    if (req.user && ROLES.ADMIN_AND_ABOVE.includes(req.user.role as UserRole)) {
      includeInactive = true;
    }
  }

  const departments = await departmentService.getAllDepartments(includeInactive);

  res.status(200).json({
    success: true,
    data: departments,
  });
});

/**
 * @desc    Get single department by slug
 * @route   GET /api/departments/:slug
 * @access  Public
 */
export const getDepartmentBySlug = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;
  const department = await departmentService.getDepartmentBySlug(slug);

  if (!department) {
    throw new AppError('Department not found', 404);
  }

  // If inactive and requester is not admin/owner, treat as not found
  if (!department.active) {
    const isAuthorized = req.user && ROLES.ADMIN_AND_ABOVE.includes(req.user.role as UserRole);
    if (!isAuthorized) {
      throw new AppError('Department not found', 404);
    }
  }

  res.status(200).json({
    success: true,
    data: department,
  });
});

/**
 * @desc    Create a new department
 * @route   POST /api/departments
 * @access  Admin, Owner
 */
export const createDepartment = asyncHandler(async (req: Request, res: Response) => {
  let parsed;
  try {
    parsed = CreateDepartmentSchema.parse(req.body);
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

  const department = await departmentService.createDepartment(parsed);

  res.status(201).json({
    success: true,
    data: department,
    message: 'Department created successfully',
  });
});

/**
 * @desc    Update an existing department
 * @route   PATCH /api/departments/:id
 * @access  Admin, Owner
 */
export const updateDepartment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  let parsed;
  try {
    parsed = UpdateDepartmentSchema.parse(req.body);
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

  const department = await departmentService.updateDepartment(id, parsed);

  res.status(200).json({
    success: true,
    data: department,
    message: 'Department updated successfully',
  });
});

/**
 * @desc    Deactivate a department (sets active: false)
 * @route   PATCH /api/departments/:id/deactivate
 * @access  Admin, Owner
 */
export const deactivateDepartment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const department = await departmentService.deactivateDepartment(id);

  res.status(200).json({
    success: true,
    data: department,
    message: 'Department deactivated successfully',
  });
});
