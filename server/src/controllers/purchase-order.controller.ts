import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../middleware/error.middleware';
import { purchaseOrderService } from '../services/purchase-order.service';
import { asyncHandler } from '../utils/asyncHandler';
import {
  CreatePurchaseOrderSchema,
  UpdatePurchaseOrderSchema,
  AdvancePOStatusSchema,
  GetPurchaseOrdersQuerySchema,
  ReceivePOSchema,
  SubmitQuoteSchema,
  DeclinePOSchema,
  DecideQuoteSchema,
  ReviewPaymentSchema,
} from '../validators/purchase-order.validator';
import { POStatus } from '../models/PurchaseOrder';
import { uploadToGridFS } from '../services/gridfs.service';

function parseOrThrow<T>(schema: { parse: (v: unknown) => T }, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({ field: e.path.join('.'), message: e.message }));
      throw new AppError(err.errors[0]?.message || 'Validation failed', 400, errors);
    }
    throw err;
  }
}

/**
 * @desc    List purchase orders with status + supplier filter
 * @route   GET /api/admin/purchase-orders
 * @access  Private (admin, owner)
 */
export const getPurchaseOrders = asyncHandler(async (req: Request, res: Response) => {
  const query = parseOrThrow(GetPurchaseOrdersQuerySchema, req.query);
  const result = await purchaseOrderService.getPurchaseOrders(query);

  res.status(200).json({
    success: true,
    data: result,
    message: 'Purchase orders retrieved successfully',
  });
});

/**
 * @desc    Get single purchase order
 * @route   GET /api/admin/purchase-orders/:id
 * @access  Private (admin, owner)
 */
export const getPurchaseOrderById = asyncHandler(async (req: Request, res: Response) => {
  const po = await purchaseOrderService.getPurchaseOrderById(req.params.id);

  res.status(200).json({
    success: true,
    data: { purchaseOrder: po },
    message: 'Purchase order retrieved successfully',
  });
});

/**
 * @desc    Create purchase order
 * @route   POST /api/admin/purchase-orders
 * @access  Private (admin, owner)
 */
export const createPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const parsed = parseOrThrow(CreatePurchaseOrderSchema, req.body);
  const po = await purchaseOrderService.createPurchaseOrder(parsed);

  res.status(201).json({
    success: true,
    data: { purchaseOrder: po },
    message: 'Purchase order created successfully',
  });
});

/**
 * @desc    Update purchase order (requested only)
 * @route   PATCH /api/admin/purchase-orders/:id
 * @access  Private (admin, owner)
 */
export const updatePurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const parsed = parseOrThrow(UpdatePurchaseOrderSchema, req.body);
  const po = await purchaseOrderService.updatePurchaseOrder(req.params.id, parsed);

  res.status(200).json({
    success: true,
    data: { purchaseOrder: po },
    message: 'Purchase order updated successfully',
  });
});

/**
 * @desc    Advance purchase order status (linear state machine)
 * @route   PATCH /api/admin/purchase-orders/:id/status
 * @access  Private (admin, owner)
 */
export const advancePurchaseOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const parsed = parseOrThrow(AdvancePOStatusSchema, req.body);
  const po = await purchaseOrderService.advanceStatus(req.params.id, parsed.status as POStatus);

  res.status(200).json({
    success: true,
    data: { purchaseOrder: po },
    message: `Purchase order status updated to '${po.status}'`,
  });
});

/**
 * @desc    Cancel a purchase order (requested, admin_approved, admin_rejected, payment_rejected, confirmed)
 * @route   PATCH /api/admin/purchase-orders/:id/cancel
 * @access  Private (admin, owner)
 */
export const cancelPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const po = await purchaseOrderService.cancelPurchaseOrder(req.params.id);

  res.status(200).json({
    success: true,
    data: { purchaseOrder: po },
    message: 'Purchase order cancelled successfully',
  });
});

/**
 * @desc    Receive stock against a purchase order (partial or full)
 * @route   PATCH /api/admin/purchase-orders/:id/receive
 * @access  Private (staff, admin, owner)
 */
export const receivePurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const parsed = parseOrThrow(ReceivePOSchema, req.body);
  const po = await purchaseOrderService.receivePurchaseOrder(req.params.id, parsed);

  res.status(200).json({
    success: true,
    data: { purchaseOrder: po },
    message: 'Stock received and inventory updated successfully',
  });
});

/**
 * @desc    Submit quote for a purchase order (supplier only)
 * @route   PATCH /api/supplier/purchase-orders/:id/quote
 * @access  Private (supplier)
 */
export const submitQuote = asyncHandler(async (req: Request, res: Response) => {
  const supplierUserId = req.user?._id;
  if (!supplierUserId) {
    throw new AppError('Not authenticated', 401);
  }
  const parsed = parseOrThrow(SubmitQuoteSchema, req.body);
  const po = await purchaseOrderService.submitQuote(req.params.id, parsed, supplierUserId);

  res.status(200).json({
    success: true,
    data: { purchaseOrder: po },
    message: 'Quote submitted successfully',
  });
});

/**
 * @desc    Decline a purchase order request (supplier only)
 * @route   PATCH /api/supplier/purchase-orders/:id/decline
 * @access  Private (supplier)
 */
export const declinePurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const supplierUserId = req.user?._id;
  if (!supplierUserId) {
    throw new AppError('Not authenticated', 401);
  }
  const parsed = parseOrThrow(DeclinePOSchema, req.body);
  const po = await purchaseOrderService.declinePurchaseOrder(req.params.id, parsed, supplierUserId);

  res.status(200).json({
    success: true,
    data: { purchaseOrder: po },
    message: 'Purchase order declined successfully',
  });
});

/**
 * @desc    Admin approves or rejects a supplier quote
 * @route   PATCH /api/admin/purchase-orders/:id/decide-quote
 * @access  Private (admin, owner)
 */
export const decideQuote = asyncHandler(async (req: Request, res: Response) => {
  const parsed = parseOrThrow(DecideQuoteSchema, req.body);
  const po = await purchaseOrderService.decideQuote(req.params.id, parsed);

  res.status(200).json({
    success: true,
    data: { purchaseOrder: po },
    message: `Quote ${parsed.decision === 'approve' ? 'approved' : 'rejected'} successfully`,
  });
});

/**
 * @desc    Upload payment slip for an approved/payment-rejected purchase order
 * @route   PATCH /api/admin/purchase-orders/:id/payment-slip
 * @access  Private (admin, owner)
 */
export const submitPaymentSlip = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file || !req.file.buffer) {
    throw new AppError('Payment slip file is required', 400);
  }

  const { id } = req.params;

  const sanitizedOriginalName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  const uniqueFilename = `po-${id}-slip-${Date.now()}-${sanitizedOriginalName}`;

  const gridFile = await uploadToGridFS(
    req.file.buffer,
    uniqueFilename,
    req.file.mimetype,
    {
      purchaseOrderId: id,
      uploadedBy: req.user?._id?.toString(),
      type: 'po_payment_slip',
    }
  );

  const po = await purchaseOrderService.submitPaymentSlip(id, gridFile.url);

  res.status(200).json({
    success: true,
    data: { purchaseOrder: po },
    message: 'Payment slip submitted successfully',
  });
});

/**
 * @desc    Supplier approves or rejects admin-uploaded payment slip
 * @route   PATCH /api/supplier/purchase-orders/:id/review-payment
 * @access  Private (supplier)
 */
export const reviewPayment = asyncHandler(async (req: Request, res: Response) => {
  const supplierUserId = req.user?._id;
  if (!supplierUserId) {
    throw new AppError('Not authenticated', 401);
  }
  const parsed = parseOrThrow(ReviewPaymentSchema, req.body);
  const po = await purchaseOrderService.reviewPayment(req.params.id, parsed, supplierUserId);

  res.status(200).json({
    success: true,
    data: { purchaseOrder: po },
    message: `Payment slip ${parsed.decision === 'approve' ? 'approved' : 'rejected'} successfully`,
  });
});

/**
 * @desc    Supplier marks a confirmed purchase order as shipped (in_transit)
 * @route   PATCH /api/supplier/purchase-orders/:id/ship
 * @access  Private (supplier)
 */
export const markShipped = asyncHandler(async (req: Request, res: Response) => {
  const supplierUserId = req.user?._id;
  if (!supplierUserId) {
    throw new AppError('Not authenticated', 401);
  }
  const po = await purchaseOrderService.markShipped(req.params.id, supplierUserId);

  res.status(200).json({
    success: true,
    data: { purchaseOrder: po },
    message: 'Purchase order marked as shipped',
  });
});
