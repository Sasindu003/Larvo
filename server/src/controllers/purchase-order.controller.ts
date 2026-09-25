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
} from '../validators/purchase-order.validator';
import { POStatus } from '../models/PurchaseOrder';

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
 * @desc    Update purchase order (draft only)
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
 * @desc    Cancel a purchase order (draft, submitted, confirmed only)
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
