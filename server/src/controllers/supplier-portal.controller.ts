import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ZodError } from 'zod';
import { AppError } from '../middleware/error.middleware';
import Supplier from '../models/Supplier';
import User from '../models/User';
import { purchaseOrderService } from '../services/purchase-order.service';
import { supplierService } from '../services/supplier.service';
import { SupplierRespondSchema } from '../validators/purchase-order.validator';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Helper to ensure supplierId is attached to req.user
 */
function getSupplierIdOrThrow(req: Request): Types.ObjectId {
  const supplierId = req.user?.supplierId;
  if (!supplierId || !Types.ObjectId.isValid(supplierId.toString())) {
    throw new AppError('No supplier profile is associated with this account', 403);
  }
  return new Types.ObjectId(supplierId.toString());
}

/**
 * @desc    Get current authenticated supplier's company profile
 * @route   GET /api/supplier/me
 * @access  Private (supplier)
 */
export const getSupplierMe = asyncHandler(async (req: Request, res: Response) => {
  const supplierId = getSupplierIdOrThrow(req);
  const supplier = await Supplier.findById(supplierId);

  if (!supplier) {
    throw new AppError('Supplier record not found', 404);
  }

  res.status(200).json({
    success: true,
    data: {
      supplier,
      user: {
        _id: req.user?._id,
        name: req.user?.name,
        email: req.user?.email,
        role: req.user?.role,
      },
    },
    message: 'Supplier profile retrieved successfully',
  });
});

/**
 * @desc    Get purchase orders for current supplier
 * @route   GET /api/supplier/purchase-orders
 * @access  Private (supplier)
 */
export const getSupplierPurchaseOrders = asyncHandler(async (req: Request, res: Response) => {
  const supplierId = getSupplierIdOrThrow(req);

  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const status = req.query.status as string | undefined;

  const result = await purchaseOrderService.getPurchaseOrders({
    page,
    limit,
    status: status as any,
    supplier: supplierId.toString(),
  });

  res.status(200).json({
    success: true,
    data: result,
    message: 'Purchase orders retrieved successfully',
  });
});

/**
 * @desc    Get single purchase order details for current supplier
 * @route   GET /api/supplier/purchase-orders/:id
 * @access  Private (supplier)
 */
export const getSupplierPurchaseOrderById = asyncHandler(async (req: Request, res: Response) => {
  const supplierId = getSupplierIdOrThrow(req);
  const po = await purchaseOrderService.getPurchaseOrderById(req.params.id);

  const poSupplierId = (po.supplier as any)?._id?.toString() || po.supplier?.toString();
  if (poSupplierId !== supplierId.toString()) {
    throw new AppError('You do not have permission to view this purchase order', 403);
  }

  res.status(200).json({
    success: true,
    data: { purchaseOrder: po },
    message: 'Purchase order details retrieved successfully',
  });
});

/**
 * @desc    Get products and variants linked to current supplier
 * @route   GET /api/supplier/products
 * @access  Private (supplier)
 */
export const getSupplierProducts = asyncHandler(async (req: Request, res: Response) => {
  const supplierId = getSupplierIdOrThrow(req);
  const data = await supplierService.getSupplierProducts(supplierId.toString());

  res.status(200).json({
    success: true,
    data,
    message: 'Supplier catalog retrieved successfully',
  });
});

/**
 * @desc    Change password for supplier user
 * @route   PATCH /api/supplier/change-password
 * @access  Private (supplier)
 */
export const changeSupplierPassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError('Please provide both current and new password', 400);
  }

  if (newPassword.length < 6) {
    throw new AppError('New password must be at least 6 characters long', 400);
  }

  const user = await User.findById(req.user?._id).select('+passwordHash');
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new AppError('Current password is incorrect', 400);
  }

  user.passwordHash = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password updated successfully',
  });
});

/**
 * @desc    Supplier responds to a purchase order request (accept or decline with feedback)
 * @route   PATCH /api/supplier/purchase-orders/:id/respond
 * @access  Private (supplier, staff, admin, owner)
 */
export const respondToPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const supplierId = getSupplierIdOrThrow(req);

  let parsed;
  try {
    parsed = SupplierRespondSchema.parse(req.body);
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({ field: e.path.join('.'), message: e.message }));
      throw new AppError(err.errors[0]?.message || 'Validation failed', 400, errors);
    }
    throw err;
  }

  const updatedPO = await purchaseOrderService.respondToPurchaseOrder(
    req.params.id,
    supplierId.toString(),
    parsed
  );

  res.status(200).json({
    success: true,
    data: { purchaseOrder: updatedPO },
    message: `Purchase order response submitted successfully (${parsed.decision})`,
  });
});

