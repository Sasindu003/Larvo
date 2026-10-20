import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ZodError } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/error.middleware';
import { staffService } from '../services/staff.service';
import User, { UserRole } from '../models/User';
import { audit } from '../services/audit.service';
import {
  CreateStaffSchema,
  UpdateStaffSchema,
  ListStaffQuerySchema,
} from '../validators/staff.validator';

/**
 * @desc    Get paginated staff directory (non-customer accounts)
 * @route   GET /api/staff
 * @access  Admin, Owner
 */
export const getStaff = asyncHandler(async (req: Request, res: Response) => {
  let query;
  try {
    query = ListStaffQuerySchema.parse(req.query);
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Invalid query parameters', 422, errors);
    }
    throw err;
  }

  const result = await staffService.listStaff(query);

  res.status(200).json({
    success: true,
    data: result,
    message: 'Staff directory fetched successfully',
  });
});

/**
 * @desc    Create a new staff account (direct provisioning)
 * @route   POST /api/staff
 * @access  Admin, Owner
 */
export const createStaff = asyncHandler(async (req: Request, res: Response) => {
  let parsed;
  try {
    parsed = CreateStaffSchema.parse(req.body);
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

  const callerRole = req.user!.role as UserRole;
  const user = await staffService.createStaff(parsed, callerRole);

  res.status(201).json({
    success: true,
    data: { user },
    message: 'Staff member created successfully',
  });
});

/**
 * @desc    Update a staff account (name, active, role)
 * @route   PATCH /api/staff/:id
 * @access  Admin, Owner
 */
export const updateStaff = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid staff ID format', 400);
  }

  let parsed;
  try {
    parsed = UpdateStaffSchema.parse(req.body);
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

  const callerId = req.user!._id;
  const callerRole = req.user!.role as UserRole;

  let previousRole: string | undefined;
  if (parsed.role) {
    const existing = await User.findById(id).select('role');
    previousRole = existing?.role;
  }

  const updatedUser = await staffService.updateStaff(
    callerId,
    callerRole,
    id,
    parsed
  );

  if (parsed.role && previousRole && previousRole !== parsed.role) {
    audit(req, 'USER_ROLE_CHANGE', 'User', id, {
      from: previousRole,
      to: parsed.role,
      targetUserId: id,
    });
  }

  res.status(200).json({
    success: true,
    data: { user: updatedUser },
    message: 'Staff member updated successfully',
  });
});
