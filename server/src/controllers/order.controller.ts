import { Request, Response } from 'express';
import { ZodError } from 'zod';
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

  const result = await orderService.createOrder(req.user._id, parsed);

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
  const result = await orderService.payWithWallet(req.user._id, orderId);

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

  const { orderId } = req.params;

  const sanitizedOriginalName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${sanitizedOriginalName}`;

  const gridFile = await uploadToGridFS(
    req.file.buffer,
    uniqueFilename,
    req.file.mimetype,
    {
      orderId,
      uploadedBy: req.user._id.toString(),
      type: 'payment_slip',
    }
  );

  const result = await orderService.submitPaymentSlip(req.user._id, orderId, gridFile.url);

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
      throw new AppError('Validation failed', 422, errors);
    }
    throw err;
  }

  const { orderId } = req.params;
  const result = await orderService.simulatePayment(req.user._id, orderId, parsed);

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
  const updatedOrder = await orderService.transitionStatus(
    req.user,
    orderId,
    parsed.status,
    { trackingNumber: parsed.trackingNumber }
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


