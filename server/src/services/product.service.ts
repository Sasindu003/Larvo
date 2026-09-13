import mongoose from 'mongoose';
import { Product, IProduct, VALID_SIZES, ProductSize } from '../models/Product';
import { Category } from '../models/Category';
import { Department } from '../models/Department';
import { AppError } from '../middleware/error.middleware';
import slugify from 'slugify';

export interface GetProductsQuery {
  page?: number | string;
  limit?: number | string;
  department?: string;
  category?: string;
  sort?: string;
  q?: string;
  minPrice?: number | string;
  maxPrice?: number | string;
  size?: string;
  color?: string;
  inStock?: string | boolean;
}

export interface PaginatedProducts {
  items: IProduct[];
  results: number;
  total: number;
  page: number;
  pages: number;
}

export interface VariantInput {
  size: ProductSize;
  color: string;
  material: string;
  sku: string;
  stock: number;
  supplier?: string | mongoose.Types.ObjectId | null;
}

export interface CreateProductInput {
  name: string;
  description: string;
  category: string;
  images: string[];
  basePrice: number;
  discountPrice?: number | null;
  variants: VariantInput[];
  status?: 'active' | 'draft' | 'archived';
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  category?: string;
  images?: string[];
  basePrice?: number;
  discountPrice?: number | null;
  variants?: VariantInput[];
  status?: 'active' | 'draft' | 'archived';
}

export const productService = {
  /**
   * Fetch active products with pagination, keyword search, and optional category filter
   */
  async getProducts(query: GetProductsQuery): Promise<PaginatedProducts> {
    const page = Math.max(1, parseInt(String(query.page || 1), 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(String(query.limit || 12), 10) || 12));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {
      status: 'active',
    };

    // Keyword search filter (using regex matching with fallback for partial words)
    if (query.q && query.q.trim()) {
      const searchTerm = query.q.trim();
      filter.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    // Resolve department categories if department provided
    let deptCategoryIds: mongoose.Types.ObjectId[] | null = null;
    if (query.department && String(query.department).trim()) {
      const deptVal = String(query.department).trim();
      const isObjId = mongoose.isValidObjectId(deptVal);
      const deptDoc = await Department.findOne(
        isObjId
          ? { $or: [{ _id: deptVal }, { slug: deptVal.toLowerCase() }], active: { $ne: false } }
          : { slug: deptVal.toLowerCase(), active: { $ne: false } }
      );

      if (!deptDoc) {
        return {
          items: [],
          results: 0,
          total: 0,
          page,
          pages: 1,
        };
      }

      const deptCats = await Category.find({
        department: deptDoc._id,
        active: { $ne: false },
      }).select('_id');

      deptCategoryIds = deptCats.map((c) => c._id as mongoose.Types.ObjectId);

      if (deptCategoryIds.length === 0) {
        return {
          items: [],
          results: 0,
          total: 0,
          page,
          pages: 1,
        };
      }
    }

    // Filter by category slug/id if provided
    if (query.category && String(query.category).trim()) {
      const catVal = String(query.category).trim();
      const isObjId = mongoose.isValidObjectId(catVal);
      const categoryDoc = await Category.findOne(
        isObjId
          ? { $or: [{ _id: catVal }, { slug: catVal.toLowerCase() }], active: { $ne: false } }
          : { slug: catVal.toLowerCase(), active: { $ne: false } }
      );

      if (!categoryDoc) {
        return {
          items: [],
          results: 0,
          total: 0,
          page,
          pages: 1,
        };
      }

      // If department was also specified, ensure the category belongs to that department
      if (deptCategoryIds) {
        const belongs = deptCategoryIds.some(
          (id) => id.toString() === categoryDoc._id.toString()
        );
        if (!belongs) {
          return {
            items: [],
            results: 0,
            total: 0,
            page,
            pages: 1,
          };
        }
      }

      filter.category = categoryDoc._id;
    } else if (deptCategoryIds) {
      // If only department is specified, match all categories belonging to that department
      filter.category = { $in: deptCategoryIds };
    }

    // Determine sort order (price_asc, price_desc, newest, popular)
    let sortOptions: Record<string, 1 | -1> = { createdAt: -1 };
    if (query.sort === 'price_asc' || query.sort === 'price-asc') {
      sortOptions = { basePrice: 1, _id: 1 };
    } else if (query.sort === 'price_desc' || query.sort === 'price-desc') {
      sortOptions = { basePrice: -1, _id: -1 };
    } else if (query.sort === 'popular') {
      sortOptions = { ratingCount: -1, ratingAvg: -1, _id: -1 };
    } else if (query.sort === 'newest') {
      sortOptions = { createdAt: -1, _id: -1 };
    }

    // Price range filter (inclusive boundary on effective selling price)
    const minPrice = query.minPrice !== undefined && query.minPrice !== '' ? parseFloat(String(query.minPrice)) : null;
    const maxPrice = query.maxPrice !== undefined && query.maxPrice !== '' ? parseFloat(String(query.maxPrice)) : null;
    if (minPrice !== null && !isNaN(minPrice)) {
      filter.basePrice = { ...(filter.basePrice || {}), $gte: minPrice };
    }
    if (maxPrice !== null && !isNaN(maxPrice)) {
      filter.basePrice = { ...(filter.basePrice || {}), $lte: maxPrice };
    }

    // Variant-level filters: size and/or color — use elemMatch on variants array
    const variantMatch: Record<string, any> = {};
    if (query.size && query.size.trim()) {
      variantMatch.size = query.size.trim().toUpperCase();
    }
    if (query.color && query.color.trim()) {
      variantMatch.color = { $regex: query.color.trim(), $options: 'i' };
    }
    // inStock filter: at least one variant with stock > 0 (plus matching size/color if set)
    if (query.inStock === 'true' || query.inStock === true) {
      variantMatch.stock = { $gt: 0 };
    }
    if (Object.keys(variantMatch).length > 0) {
      filter.variants = { $elemMatch: variantMatch };
    }

    const [total, items] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .populate('category', 'name slug image')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit),
    ]);

    const pages = Math.ceil(total / limit) || 1;

    return {
      items,
      results: items.length,
      total,
      page,
      pages,
    };
  },

  /**
   * Lightweight autosuggest query returning top 5 matching active products
   */
  async getSuggestions(q?: string): Promise<IProduct[]> {
    if (!q || !q.trim()) {
      return [];
    }

    const searchTerm = q.trim();
    const filter = {
      status: 'active',
      name: { $regex: searchTerm, $options: 'i' },
    };

    const suggestions = await Product.find(filter)
      .select('_id name slug images basePrice discountPrice category ratingAvg')
      .populate('category', 'name slug')
      .limit(5);

    return suggestions;
  },

  /**
   * Fetch single product by slug (with populated category)
   */
  async getProductBySlug(slug: string): Promise<IProduct> {
    const product = await Product.findOne({ slug, status: 'active' }).populate(
      'category',
      'name slug image'
    );

    if (!product) {
      throw new AppError(`Product with slug '${slug}' not found`, 404);
    }

    return product;
  },

  /**
   * Validate that the product's category exists and its department is active
   * (Throws 400 AppError if invalid)
   */
  async validateProductCategory(categoryId: string | import('mongoose').Types.ObjectId): Promise<void> {
    const categoryDoc = await Category.findById(categoryId).populate('department');
    if (!categoryDoc) {
      throw new AppError(`Category not found.`, 400);
    }

    if (categoryDoc.department && !(categoryDoc.department as any).active) {
      throw new AppError(`Cannot assign category: Department '${(categoryDoc.department as any).name}' is currently deactivated.`, 400);
    }
  },

  /**
   * Admin: get all products (any status) with pagination, search, and status filter
   */
  async getAdminProducts(query: {
    page?: number | string;
    limit?: number | string;
    q?: string;
    status?: string;
  }): Promise<PaginatedProducts> {
    const page = Math.max(1, parseInt(String(query.page || 1), 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(String(query.limit || 15), 10) || 15));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (query.status && ['active', 'draft', 'archived'].includes(query.status)) {
      filter.status = query.status;
    }

    if (query.q && query.q.trim()) {
      filter.$or = [
        { name: { $regex: query.q.trim(), $options: 'i' } },
        { 'variants.sku': { $regex: query.q.trim(), $options: 'i' } },
      ];
    }

    const [total, items] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .populate('category', 'name slug')
        .populate('variants.supplier', 'name companyName email status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    return {
      items,
      results: items.length,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    };
  },

  /**
   * Admin: create a new product.
   * Validates category (must be active + department active), deduplicates slug,
   * checks SKU uniqueness via the global index (409 on conflict).
   */
  async createProduct(input: CreateProductInput): Promise<IProduct> {
    await this.validateProductCategory(input.category);

    // Deduplicate SKUs within the input itself
    const skus = input.variants.map((v) => v.sku.trim());
    const uniqueSkus = new Set(skus);
    if (uniqueSkus.size !== skus.length) {
      const dup = skus.find((s, i) => skus.indexOf(s) !== i);
      throw new AppError(`Duplicate SKU '${dup}' found in variant list`, 409, { sku: dup });
    }

    // Check against existing SKUs in DB
    const existingWithSku = await Product.findOne({ 'variants.sku': { $in: skus } });
    if (existingWithSku) {
      const conflict = existingWithSku.variants.find((v) => skus.includes(v.sku));
      throw new AppError(
        `SKU '${conflict?.sku}' is already in use by another product variant.`,
        409,
        { sku: conflict?.sku }
      );
    }

    // Generate unique slug
    let baseSlug = slugify(input.name, { lower: true, strict: true });
    let slug = baseSlug;
    let attempt = 0;
    while (await Product.exists({ slug })) {
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    const product = await Product.create({
      ...input,
      slug,
      variants: input.variants.map((v) => ({
        ...v,
        sku: v.sku.trim(),
        supplier: v.supplier && mongoose.isValidObjectId(v.supplier) ? new mongoose.Types.ObjectId(String(v.supplier)) : null,
      })),
    });

    return (await Product.findById(product._id)
      .populate('category', 'name slug image')
      .populate('variants.supplier', 'name companyName email status'))!;
  },

  /**
   * Admin: update a product by ID.
   * Validates category if changed, validates SKU uniqueness for any new/changed SKUs.
   */
  async updateProduct(productId: string, input: UpdateProductInput): Promise<IProduct> {
    const existing = await Product.findById(productId);
    if (!existing) {
      throw new AppError('Product not found', 404);
    }

    if (input.category && input.category !== existing.category.toString()) {
      await this.validateProductCategory(input.category);
    }

    if (input.variants && input.variants.length > 0) {
      const newSkus = input.variants.map((v) => v.sku.trim());
      const uniqueSkus = new Set(newSkus);
      if (uniqueSkus.size !== newSkus.length) {
        const dup = newSkus.find((s, i) => newSkus.indexOf(s) !== i);
        throw new AppError(`Duplicate SKU '${dup}' found in variant list`, 409, { sku: dup });
      }

      // Find existing SKUs that belong to OTHER products
      const existingProductSkus = existing.variants.map((v) => v.sku);
      const brandNewSkus = newSkus.filter((s) => !existingProductSkus.includes(s));

      if (brandNewSkus.length > 0) {
        const conflict = await Product.findOne({
          _id: { $ne: productId },
          'variants.sku': { $in: brandNewSkus },
        });
        if (conflict) {
          const conflictVariant = conflict.variants.find((v) => brandNewSkus.includes(v.sku));
          throw new AppError(
            `SKU '${conflictVariant?.sku}' is already in use by another product.`,
            409,
            { sku: conflictVariant?.sku }
          );
        }
      }
    }

    // If name changed, regenerate slug
    if (input.name && input.name !== existing.name) {
      let baseSlug = slugify(input.name, { lower: true, strict: true });
      let slug = baseSlug;
      let attempt = 0;
      while (await Product.exists({ slug, _id: { $ne: productId } })) {
        attempt++;
        slug = `${baseSlug}-${attempt}`;
      }
      (input as any).slug = slug;
    }

    if (input.variants) {
      (input as any).variants = input.variants.map((v) => ({
        ...v,
        sku: v.sku.trim(),
        supplier: v.supplier && mongoose.isValidObjectId(v.supplier) ? new mongoose.Types.ObjectId(String(v.supplier)) : null,
      }));
    }

    const updated = await Product.findByIdAndUpdate(
      productId,
      { $set: input },
      { new: true, runValidators: true }
    )
      .populate('category', 'name slug image')
      .populate('variants.supplier', 'name companyName email status');

    if (!updated) throw new AppError('Product not found', 404);
    return updated;
  },

  /**
   * Admin/Owner: soft-delete a product by setting status to 'archived'.
   * Never hard-deletes.
   */
  async archiveProduct(productId: string): Promise<IProduct> {
    const product = await Product.findByIdAndUpdate(
      productId,
      { $set: { status: 'archived' } },
      { new: true }
    ).populate('category', 'name slug image');

    if (!product) throw new AppError('Product not found', 404);
    return product;
  },

};

export default productService;

