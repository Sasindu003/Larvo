import crypto from 'crypto';
import { Types } from 'mongoose';
import { AppError } from '../middleware/error.middleware';
import Supplier, { ISupplier } from '../models/Supplier';
import User from '../models/User';
import { Product } from '../models/Product';
import {
  CreateSupplierInput,
  GetSuppliersQuery,
  UpdateSupplierInput,
} from '../validators/supplier.validator';

export interface PaginatedSuppliers {
  results: ISupplier[];
  total: number;
  page: number;
  pages: number;
}

export class SupplierService {
  /**
   * List suppliers with search across name, companyName, email and status filtering.
   */
  async getSuppliers(query: GetSuppliersQuery): Promise<PaginatedSuppliers> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 10));
    const skip = (page - 1) * limit;

    const filter: any = {};

    // Status filtering
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }

    // Search across name, companyName, and email
    if (query.search && query.search.trim()) {
      const searchRegex = new RegExp(query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: searchRegex },
        { companyName: searchRegex },
        { email: searchRegex },
      ];
    }

    const [results, total] = await Promise.all([
      Supplier.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Supplier.countDocuments(filter),
    ]);

    return {
      results: results as unknown as ISupplier[],
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Get supplier by ID.
   */
  async getSupplierById(id: string): Promise<ISupplier> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid supplier ID format', 400);
    }

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }

    return supplier;
  }

  /**
   * Create a new supplier.
   */
  async createSupplier(input: CreateSupplierInput): Promise<ISupplier> {
    const existing = await Supplier.findOne({
      email: input.email.toLowerCase().trim(),
    });

    if (existing) {
      throw new AppError(`A supplier with email '${input.email}' already exists`, 409);
    }

    const supplier = await Supplier.create({
      ...input,
      email: input.email.toLowerCase().trim(),
      status: 'active',
    });

    return supplier;
  }

  /**
   * Update supplier details.
   */
  async updateSupplier(id: string, input: UpdateSupplierInput): Promise<ISupplier> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid supplier ID format', 400);
    }

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }

    if (input.email && input.email.toLowerCase().trim() !== supplier.email) {
      const conflict = await Supplier.findOne({
        _id: { $ne: supplier._id },
        email: input.email.toLowerCase().trim(),
      });
      if (conflict) {
        throw new AppError(`A supplier with email '${input.email}' already exists`, 409);
      }
      supplier.email = input.email.toLowerCase().trim();
    }

    if (input.name !== undefined) supplier.name = input.name;
    if (input.companyName !== undefined) supplier.companyName = input.companyName;
    if (input.phone !== undefined) supplier.phone = input.phone;
    if (input.address !== undefined) supplier.address = input.address;
    if (input.status !== undefined) supplier.status = input.status;
    if (input.notes !== undefined) supplier.notes = input.notes;

    await supplier.save();
    return supplier;
  }

  /**
   * Deactivate a supplier (status -> inactive).
   */
  async deactivateSupplier(id: string): Promise<ISupplier> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid supplier ID format', 400);
    }

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }

    supplier.status = 'inactive';
    await supplier.save();

    if (supplier.userId) {
      await User.findByIdAndUpdate(supplier.userId, { active: false });
    }

    return supplier;
  }

  /**
   * Reactivate a supplier (status -> active).
   */
  async reactivateSupplier(id: string): Promise<ISupplier> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid supplier ID format', 400);
    }

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }

    supplier.status = 'active';
    await supplier.save();

    if (supplier.userId) {
      await User.findByIdAndUpdate(supplier.userId, { active: true });
    }

    return supplier;
  }

  /**
   * Create or link portal User account for a supplier.
   * Generates a secure temporary password and returns credentials.
   */
  async createSupplierAccount(id: string): Promise<{ supplier: ISupplier; credentials: { email: string; tempPassword: string } }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid supplier ID format', 400);
    }

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }

    if (supplier.userId) {
      const existingUser = await User.findById(supplier.userId);
      if (existingUser) {
        throw new AppError('Portal account already exists for this supplier', 409);
      }
    }

    const email = supplier.email.toLowerCase().trim();
    const existingEmailUser = await User.findOne({ email });
    if (existingEmailUser) {
      throw new AppError(`A user account with email '${email}' already exists in the system`, 409);
    }

    // Generate readable, secure temporary password (e.g., Supp#a8b7c6d5)
    const tempPassword = `Supp#${crypto.randomBytes(4).toString('hex')}`;

    const user = await User.create({
      name: supplier.name || supplier.companyName,
      email,
      passwordHash: tempPassword,
      role: 'supplier',
      supplierId: supplier._id,
      active: supplier.status === 'active',
    });

    supplier.userId = user._id as Types.ObjectId;
    await supplier.save();

    return {
      supplier,
      credentials: {
        email,
        tempPassword,
      },
    };
  }

  /**
   * Get products and variants supplied by a given supplier.
   */
  async getSupplierProducts(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid supplier ID format', 400);
    }

    const supplier = await Supplier.findById(id).lean();
    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }

    const products = await Product.find({ 'variants.supplier': id })
      .populate('category', 'name slug')
      .lean();

    const items = products.map((p: any) => {
      const matchedVariants = (p.variants || []).filter(
        (v: any) => v.supplier && v.supplier.toString() === id
      );
      return {
        _id: p._id,
        name: p.name,
        slug: p.slug,
        images: p.images,
        category: p.category,
        basePrice: p.basePrice,
        status: p.status,
        variants: matchedVariants,
      };
    });

    const totalVariants = items.reduce((sum, item) => sum + item.variants.length, 0);

    return {
      supplier,
      products: items,
      totalProducts: items.length,
      totalVariants,
    };
  }

  /**
   * Delete supplier with referential integrity enforcement.
   * If any product variant references this supplier, delete is disallowed with 409 Conflict.
   */
  async deleteSupplier(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid supplier ID format', 400);
    }

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }

    const inUse = await Product.exists({ 'variants.supplier': id });
    if (inUse) {
      throw new AppError(
        'Cannot delete supplier because it is referenced by existing product variants. Deactivate instead.',
        409
      );
    }

    await Supplier.findByIdAndDelete(id);
  }
}

export const supplierService = new SupplierService();
export default supplierService;
