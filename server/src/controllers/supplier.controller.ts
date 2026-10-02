import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../middleware/error.middleware';
import { supplierService } from '../services/supplier.service';
import { asyncHandler } from '../utils/asyncHandler';
import {
  CreateSupplierSchema,
  GetSuppliersQuerySchema,
  UpdateSupplierSchema,
} from '../validators/supplier.validator';

/**
 * @desc    Get suppliers directory with search and status filtering
 * @route   GET /api/admin/suppliers
 * @access  Private (staff, admin, owner)
 */
export const getSuppliers = asyncHandler(async (req: Request, res: Response) => {
  let query;
  try {
    query = GetSuppliersQuerySchema.parse(req.query);
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

  const result = await supplierService.getSuppliers(query);

  res.status(200).json({
    success: true,
    data: result,
    message: 'Suppliers retrieved successfully',
  });
});

/**
 * @desc    Get single supplier details
 * @route   GET /api/admin/suppliers/:id
 * @access  Private (staff, admin, owner)
 */
export const getSupplierById = asyncHandler(async (req: Request, res: Response) => {
  const supplier = await supplierService.getSupplierById(req.params.id);

  res.status(200).json({
    success: true,
    data: { supplier },
    message: 'Supplier retrieved successfully',
  });
});

/**
 * @desc    Create a new supplier
 * @route   POST /api/admin/suppliers
 * @access  Private (admin, owner)
 */
export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  let parsed;
  try {
    parsed = CreateSupplierSchema.parse(req.body);
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

  const supplier = await supplierService.createSupplier(parsed);

  let credentials: { email: string; tempPassword: string } | null = null;
  // If requested or auto-create enabled (defaults to true if createAccount !== false)
  if (req.body.createAccount !== false) {
    try {
      const accountRes = await supplierService.createSupplierAccount(supplier._id.toString());
      credentials = accountRes.credentials;
    } catch {
      // Ignore if user account creation fails (e.g. existing email conflict), supplier is still created
    }
  }

  res.status(201).json({
    success: true,
    data: { supplier, credentials },
    message: credentials
      ? 'Supplier and portal account created successfully'
      : 'Supplier created successfully',
  });
});

/**
 * @desc    Create/generate portal User account for existing supplier
 * @route   POST /api/admin/suppliers/:id/create-account
 * @access  Private (admin, owner)
 */
export const createSupplierAccount = asyncHandler(async (req: Request, res: Response) => {
  const result = await supplierService.createSupplierAccount(req.params.id);

  res.status(201).json({
    success: true,
    data: result,
    message: 'Portal account created successfully',
  });
});

/**
 * @desc    Update supplier details
 * @route   PATCH /api/admin/suppliers/:id
 * @access  Private (admin, owner)
 */
export const updateSupplier = asyncHandler(async (req: Request, res: Response) => {
  let parsed;
  try {
    parsed = UpdateSupplierSchema.parse(req.body);
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

  const supplier = await supplierService.updateSupplier(req.params.id, parsed);

  res.status(200).json({
    success: true,
    data: { supplier },
    message: 'Supplier updated successfully',
  });
});

/**
 * @desc    Deactivate a supplier
 * @route   PATCH /api/admin/suppliers/:id/deactivate
 * @access  Private (admin, owner)
 */
export const deactivateSupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplier = await supplierService.deactivateSupplier(req.params.id);

  res.status(200).json({
    success: true,
    data: { supplier },
    message: 'Supplier deactivated successfully',
  });
});

/**
 * @desc    Get products and variants supplied by a supplier
 * @route   GET /api/admin/suppliers/:id/products
 * @access  Private (staff, admin, owner)
 */
export const getSupplierProducts = asyncHandler(async (req: Request, res: Response) => {
  const data = await supplierService.getSupplierProducts(req.params.id);

  res.status(200).json({
    success: true,
    data,
    message: 'Supplier products retrieved successfully',
  });
});

/**
 * @desc    Delete supplier (disallowed if referenced by variants -> 409)
 * @route   DELETE /api/admin/suppliers/:id
 * @access  Private (admin, owner)
 */
export const deleteSupplier = asyncHandler(async (req: Request, res: Response) => {
  await supplierService.deleteSupplier(req.params.id);

  res.status(200).json({
    success: true,
    data: null,
    message: 'Supplier deleted successfully',
  });
});
