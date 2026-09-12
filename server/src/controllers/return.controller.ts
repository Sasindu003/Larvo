import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../middleware/error.middleware';
import { returnService } from '../services/return.service';
import { asyncHandler } from '../utils/asyncHandler';
import {
  AdvanceReturnStatusSchema,
  CreateReturnRequestSchema,
  DecisionSchema,
  GetAdminReturnsQuerySchema,
  GetDeliveryReturnsQuerySchema,
  GetMyReturnsQuerySchema,
} from '../validators/return.validator';

/**
 * @desc    Submit a return request
 * @route   POST /api/returns
 * @access  Private (customer, staff, admin, owner)
 */
export const createReturn = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  let parsed;
  try {
    parsed = CreateReturnRequestSchema.parse(req.body);
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

  const returnRequest = await returnService.createReturnRequest(req.user._id, parsed);

  res.status(201).json({
    success: true,
    data: { returnRequest },
    message: 'Return request submitted successfully',
  });
});

/**
 * @desc    Get customer's return requests
 * @route   GET /api/returns/me
 * @access  Private (customer, staff, admin, owner)
 */
export const getMyReturns = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  let query;
  try {
    query = GetMyReturnsQuerySchema.parse(req.query);
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

  const result = await returnService.getMyReturnRequests(req.user._id, query);

  res.status(200).json({
    success: true,
    data: result,
    message: 'Return requests retrieved successfully',
  });
});

/**
 * @desc    Get return request by ID
 * @route   GET /api/returns/:id
 * @access  Private (Owner, staff, admin, owner)
 */
export const getReturnById = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  const returnRequest = await returnService.getReturnById(req.params.id, {
    userId: req.user._id,
    role: req.user.role,
  });

  res.status(200).json({
    success: true,
    data: { returnRequest },
    message: 'Return request details retrieved successfully',
  });
});

/**
 * @desc    Get return request for a specific order ID
 * @route   GET /api/returns/order/:orderId
 * @access  Private (Owner, staff, admin, owner)
 */
export const getReturnByOrderId = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  const returnRequest = await returnService.getReturnByOrderId(req.params.orderId, {
    userId: req.user._id,
    role: req.user.role,
  });

  res.status(200).json({
    success: true,
    data: { returnRequest },
    message: 'Return request retrieved successfully',
  });
});

/**
 * @desc    Get all return requests (staff, admin, owner)
 * @route   GET /api/admin/returns
 * @access  Private (staff, admin, owner)
 */
export const getAdminReturns = asyncHandler(async (req: Request, res: Response) => {
  let query;
  try {
    query = GetAdminReturnsQuerySchema.parse(req.query);
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Validation failed', 400, errors);
    }
    throw err;
  }

  const result = await returnService.getAdminReturns(query);

  res.status(200).json({
    success: true,
    data: result,
    message: 'Admin return requests retrieved successfully',
  });
});

/**
 * @desc    Approve or reject a return request
 * @route   PATCH /api/admin/returns/:id/decision
 * @access  Private (staff, admin, owner)
 */
export const processDecision = asyncHandler(async (req: Request, res: Response) => {
  let parsed;
  try {
    parsed = DecisionSchema.parse(req.body);
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError(err.errors[0]?.message || 'Validation failed', 400, errors);
    }
    throw err;
  }

  if (parsed.decision === 'rejected') {
    const reason = parsed.rejectionReason?.trim();
    if (!reason || reason.length === 0) {
      throw new AppError('A valid rejection reason is required when rejecting a return request', 400);
    }
    if (reason.length < 5) {
      throw new AppError('Rejection reason must be at least 5 characters', 400);
    }
  }

  const returnRequest = await returnService.processReturnDecision(req.params.id, parsed);

  res.status(200).json({
    success: true,
    data: { returnRequest },
    message: `Return request ${parsed.decision} successfully`,
  });
});

/**
 * @desc    Get return pickup queue for delivery manager
 * @route   GET /api/delivery/returns
 * @access  Private (delivery_manager, admin, owner)
 */
export const getDeliveryReturns = asyncHandler(async (req: Request, res: Response) => {
  let query;
  try {
    query = GetDeliveryReturnsQuerySchema.parse(req.query);
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Validation failed', 400, errors);
    }
    throw err;
  }

  const result = await returnService.getDeliveryReturns(query);

  res.status(200).json({
    success: true,
    data: result,
    message: 'Delivery return pickups retrieved successfully',
  });
});

/**
 * @desc    Advance return pickup status (picked_up -> received)
 * @route   PATCH /api/delivery/returns/:id/status
 * @access  Private (delivery_manager, admin, owner)
 */
export const advanceReturnStatus = asyncHandler(async (req: Request, res: Response) => {
  let parsed;
  try {
    parsed = AdvanceReturnStatusSchema.parse(req.body);
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError(err.errors[0]?.message || 'Validation failed', 400, errors);
    }
    throw err;
  }

  const returnRequest = await returnService.advanceReturnPickupStatus(
    req.params.id,
    parsed.status
  );

  res.status(200).json({
    success: true,
    data: { returnRequest },
    message: 'Return pickup status updated successfully',
  });
});

/**
 * @desc    Process wallet refund for a received return request
 * @route   PATCH /api/admin/returns/:id/refund
 * @access  Private (admin, owner)
 */
export const processRefund = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  const returnRequest = await returnService.processRefund(
    req.params.id,
    req.user._id
  );

  res.status(200).json({
    success: true,
    data: { returnRequest },
    message: 'Return refund processed successfully',
  });
});

