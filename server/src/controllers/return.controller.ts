import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../middleware/error.middleware';
import { returnService } from '../services/return.service';
import { audit, auditPiiRead } from '../services/audit.service';
import {
  applyFieldPolicy,
  checkPiiRateLimit,
  getAccessedFullPiiFields,
} from '../utils/fieldAccess';
import { ACTIVE_RETURN_PICKUP_STATUSES } from '../config/field-access';
import { uploadToGridFS } from '../services/gridfs.service';
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

  const files = (req.files as Express.Multer.File[]) || [];
  const uploadedImages = await Promise.all(
    files.map((file) =>
      uploadToGridFS(file.buffer, file.originalname, file.mimetype, {
        type: 'return_image',
        userId: req.user!._id,
        orderId: parsed.orderId,
      })
    )
  );

  const images = uploadedImages.map((img) => ({
    fileId: img.fileId,
    url: img.url,
    filename: img.filename,
  }));

  const returnRequest = await returnService.createReturnRequest(req.user._id, parsed, images);

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

  const returnUserId = (returnRequest as any).user?._id?.toString() || (returnRequest as any).user?.toString() || '';
  const isOwner = Boolean(returnUserId && returnUserId === req.user._id.toString());

  const sanitized = applyFieldPolicy('ReturnRequest', returnRequest, req.user.role, {
    isOwner,
    status: returnRequest.status,
  });

  if (!isOwner) {
    const fullPii = getAccessedFullPiiFields('ReturnRequest', req.user.role, isOwner, returnRequest.status);
    if (fullPii.length > 0) {
      auditPiiRead(req, 'ReturnRequest', returnRequest._id, fullPii, req.user.role);
    }
  }

  res.status(200).json({
    success: true,
    data: { returnRequest: sanitized },
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

  if (!returnRequest) {
    res.status(200).json({
      success: true,
      data: { returnRequest: null },
      message: 'Return request retrieved successfully',
    });
    return;
  }

  const returnUserId = (returnRequest as any).user?._id?.toString() || (returnRequest as any).user?.toString() || '';
  const isOwner = Boolean(returnUserId && returnUserId === req.user._id.toString());

  const sanitized = applyFieldPolicy('ReturnRequest', returnRequest, req.user.role, {
    isOwner,
    status: returnRequest.status,
  });

  if (!isOwner) {
    const fullPii = getAccessedFullPiiFields('ReturnRequest', req.user.role, isOwner, returnRequest.status);
    if (fullPii.length > 0) {
      auditPiiRead(req, 'ReturnRequest', returnRequest._id, fullPii, req.user.role);
    }
  }

  res.status(200).json({
    success: true,
    data: { returnRequest: sanitized },
    message: 'Return request retrieved successfully',
  });
});

/**
 * @desc    Get all return requests (staff, admin, owner)
 * @route   GET /api/admin/returns
 * @access  Private (staff, admin, owner)
 */
export const getAdminReturns = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  if (!(await checkPiiRateLimit(req, res))) {
    return;
  }

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
  const sanitized = (result.results || []).map((r: any) =>
    applyFieldPolicy('ReturnRequest', r, req.user!.role, { isOwner: false, status: r.status })
  );

  const fullPii = getAccessedFullPiiFields('ReturnRequest', req.user.role, false);
  if (fullPii.length > 0 && sanitized.length > 0) {
    auditPiiRead(req, 'ReturnRequest', null, fullPii, req.user.role);
  }

  res.status(200).json({
    success: true,
    data: {
      ...result,
      results: sanitized,
    },
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

  audit(req, 'RETURN_DECISION', 'ReturnRequest', returnRequest._id, {
    returnId: String(returnRequest._id),
    orderId: String((returnRequest.order as any)?._id || returnRequest.order),
    decision: parsed.decision,
  });

  res.status(200).json({
    success: true,
    data: { returnRequest },
    message: `Return request ${parsed.decision} successfully`,
  });
});

/**
 * @desc    Mark return request as under review
 * @route   PATCH /api/admin/returns/:id/review
 * @access  Private (staff, admin, owner)
 */
export const markUnderReview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  const returnRequest = await returnService.markUnderReview(req.params.id, {
    userId: req.user._id.toString(),
    role: req.user.role,
  });

  res.status(200).json({
    success: true,
    data: { returnRequest },
    message: 'Return request marked as under review',
  });
});

/**
 * @desc    Get return pickup queue for delivery manager
 * @route   GET /api/delivery/returns
 * @access  Private (delivery_manager, admin, owner)
 */
export const getDeliveryReturns = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  if (!(await checkPiiRateLimit(req, res))) {
    return;
  }

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
  const sanitized = (result.results || []).map((r: any) =>
    applyFieldPolicy('ReturnRequest', r, req.user!.role, { isOwner: false, status: r.status })
  );

  const hasActivePickup = sanitized.some((r: any) =>
    (ACTIVE_RETURN_PICKUP_STATUSES as readonly string[]).includes(r.status)
  );
  if (sanitized.length > 0 && (hasActivePickup || req.user.role === 'admin' || req.user.role === 'owner')) {
    const fullPii = getAccessedFullPiiFields(
      'ReturnRequest',
      req.user.role,
      false,
      hasActivePickup ? 'picked_up' : undefined
    );
    if (fullPii.length > 0) {
      auditPiiRead(req, 'ReturnRequest', null, fullPii, req.user.role);
    }
  }

  res.status(200).json({
    success: true,
    data: {
      ...result,
      results: sanitized,
    },
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
