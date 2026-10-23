import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { asyncHandler } from '../utils/asyncHandler';
import { orderService } from '../services/order.service';
import { AppError } from '../middleware/error.middleware';
import { CreateOrderSchema } from '../validators/order.validator';
import { SimulatePaymentSchema } from '../validators/simulate-payment.validator';
import { UpdateOrderStatusSchema } from '../validators/update-status.validator';
import { UpdateTrackingSchema } from '../validators/update-tracking.validator';
import { uploadToGridFS } from '../services/gridfs.service';

/**
 * @desc    Create a new order in pending_payment status
 * @route   POST /api/orders
 * @access  Private (customer, staff, admin, owner)
 */
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  let parsed;
  try {
    parsed = CreateOrderSchema.parse(req.body);
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

  const result = await orderService.createOrder(req.user._id, parsed, req);

  res.status(201).json({
    success: true,
    data: {
      order: result.order,
      couponWarning: result.couponWarning ?? null,
    },
    message: result.couponWarning
      ? `Order created with warning: ${result.couponWarning}`
      : 'Order created successfully',
  });
});

/**
 * @desc    Pay full order total with wallet reward points
 * @route   POST /api/orders/:orderId/payment/wallet
 * @access  Private (customer, staff, admin, owner)
 */
export const payOrderWithWallet = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  const { orderId } = req.params;
  const result = await orderService.payWithWallet(req.user._id, orderId, req);

  res.status(200).json({
    success: true,
    data: {
      order: result.order,
      payment: result.payment,
      pointsDeducted: result.pointsDeducted,
    },
    message: 'Payment completed successfully with reward points',
  });
});

/**
 * Validate that buffer magic bytes match allowed payment slip types:
 * JPEG, PNG, WebP, or PDF. Explicitly rejects GIF and all executable/script formats.
 */
function validateSlipMagicBytes(buffer: Buffer, declaredMimeType: string): boolean {
  if (!buffer || buffer.length < 12) {
    return false;
  }

  // Drop GIF explicitly for slips
  if (declaredMimeType === 'image/gif') {
    return false;
  }

  // JPEG: FF D8 FF
  if (
    declaredMimeType === 'image/jpeg' &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return true;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    declaredMimeType === 'image/png' &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return true;
  }

  // WebP: RIFF (52 49 46 46) ... WEBP (57 45 42 50)
  if (
    declaredMimeType === 'image/webp' &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return true;
  }

  // PDF: %PDF (25 50 44 46)
  if (
    declaredMimeType === 'application/pdf' &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return true;
  }

  return false;
}

/**
 * @desc    Upload manual payment slip for an order
 * @route   POST /api/orders/:orderId/payment/slip
 * @access  Private (customer, staff, admin, owner)
 */
export const uploadPaymentSlip = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  if (!req.file || !req.file.buffer) {
    throw new AppError('Payment slip file is required', 400);
  }

  if (!validateSlipMagicBytes(req.file.buffer, req.file.mimetype)) {
    throw new AppError(
      'Invalid payment slip format: file content must be a valid JPEG, PNG, WebP, or PDF document',
      400
    );
  }

  const { orderId } = req.params;

  // Generate randomized opaque filename; original filename stored in metadata only, never in URL
  const ext = req.file.mimetype === 'application/pdf' ? 'pdf' : (req.file.mimetype.split('/')[1] || 'bin');
  const uniqueFilename = `slip-${orderId}-${Date.now()}.${ext}`;

  const gridFile = await uploadToGridFS(
    req.file.buffer,
    uniqueFilename,
    req.file.mimetype,
    {
      orderId,
      uploadedBy: req.user._id.toString(),
      type: 'payment_slip',
      originalName: req.file.originalname,
    }
  );

  const canonicalSlipUrl = `/api/files/payment-slips/${gridFile.fileId}`;
  const result = await orderService.submitPaymentSlip(req.user._id, orderId, canonicalSlipUrl, req);

  res.status(200).json({
    success: true,
    data: {
      order: result.order,
      payment: result.payment,
    },
    message: 'Payment slip submitted successfully',
  });
});

/**
 * @desc    Simulate online payment for an order
 * @route   POST /api/orders/:orderId/payment/simulate
 * @access  Private (customer, staff, admin, owner)
 */
export const simulatePayment = asyncHandler(async (req: Request, res: Response) => {
  if (!env.PAYMENT_SIMULATOR_ENABLED) {
    throw new AppError('Payment simulator is not enabled', 404);
  }

  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  let parsed;
  try {
    parsed = SimulatePaymentSchema.parse(req.body);
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

  const { orderId } = req.params;
  const result = await orderService.simulatePayment(req.user._id, orderId, parsed, req);

  res.status(200).json({
    success: true,
    data: {
      order: result.order,
      payment: result.payment,
      approved: result.approved,
    },
    message: result.approved
      ? 'Payment processed and approved successfully'
      : 'Payment was declined by card simulator',
  });
});

/**
 * @desc    Transition order status (guarded by centralized transition map + RBAC)
 * @route   PATCH /api/orders/:orderId/status
 * @access  Private (customer for self-cancel, staff/admin/delivery_manager per transition map)
 */
export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  let parsed;
  try {
    parsed = UpdateOrderStatusSchema.parse(req.body);
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

  const { orderId } = req.params;

  if (req.user.role === 'customer' && parsed.status !== 'cancelled') {
    throw new AppError('Customers are only permitted to cancel orders', 403);
  }

  const extra = req.user.role === 'customer'
    ? undefined
    : { trackingNumber: parsed.trackingNumber };

  const updatedOrder = await orderService.transitionStatus(
    req.user,
    orderId,
    parsed.status,
    extra,
    req
  );

  res.status(200).json({
    success: true,
    data: {
      order: updatedOrder,
    },
    message: `Order status updated to '${updatedOrder.status}' successfully`,
  });
});

/**
 * @desc    Get paginated order history for the authenticated customer
 * @route   GET /api/orders/me
 * @access  Private (customer, staff, admin, owner, delivery_manager)
 */
export const getMyOrders = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  const { page, limit } = req.query;
  const result = await orderService.getMyOrders(req.user._id, {
    page: page as string,
    limit: limit as string,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get order details by ID (enforcing ownership & role-based sanitization)
 * @route   GET /api/orders/:orderId
 * @access  Private (customer own, staff, admin, owner, delivery_manager fulfillment-only)
 */
export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  const { orderId } = req.params;
  const order = await orderService.getOrderById(req.user, orderId);

  res.status(200).json({
    success: true,
    data: {
      order,
    },
  });
});

/**
 * @desc    Customer self-cancel order (allowed in pending_payment per P46)
 * @route   PATCH /api/orders/:orderId/cancel
 * @access  Private (customer own, staff, admin, owner)
 */
export const cancelMyOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  const { orderId } = req.params;
  const cancelledOrder = await orderService.cancelOrder(req.user, orderId);

  res.status(200).json({
    success: true,
    data: {
      order: cancelledOrder,
    },
    message: 'Order has been cancelled successfully',
  });
});

/**
 * @desc    Get paginated orders for staff/admin with filtering
 * @route   GET /api/admin/orders
 * @access  Private (staff, admin, owner)
 */
export const getAdminOrders = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  const { page, limit, status, search } = req.query;
  const result = await orderService.getAdminOrders({
    page: page as string,
    limit: limit as string,
    status: status as string,
    search: search as string,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Update tracking number on an order
 * @route   PATCH /api/orders/:orderId/tracking
 * @access  Private (delivery_manager, admin, owner)
 */
export const updateOrderTracking = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  let parsed;
  try {
    parsed = UpdateTrackingSchema.parse(req.body);
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

  const { orderId } = req.params;
  const updatedOrder = await orderService.updateTracking(
    req.user,
    orderId,
    parsed.trackingNumber
  );

  res.status(200).json({
    success: true,
    data: {
      order: updatedOrder,
    },
    message: 'Tracking number updated successfully',
  });
});


