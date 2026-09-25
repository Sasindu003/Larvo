import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { productService } from '../services/product.service';

// ── Public Controllers ─────────────────────────────────────────────────────────

/**
 * @desc    Get paginated active products list with search & filters
 * @route   GET /api/products
 * @access  Public
 */
export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, department, category, sort, q, minPrice, maxPrice, size, color, inStock } = req.query;

  const result = await productService.getProducts({
    page: page as string,
    limit: limit as string,
    department: department as string,
    category: category as string,
    sort: sort as string,
    q: q as string,
    minPrice: minPrice as string,
    maxPrice: maxPrice as string,
    size: size as string,
    color: color as string,
    inStock: inStock as string,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get top product suggestions for autocomplete search
 * @route   GET /api/products/suggest
 * @access  Public
 */
export const getProductSuggestions = asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.query;

  const suggestions = await productService.getSuggestions(q as string);

  res.status(200).json({
    success: true,
    data: suggestions,
  });
});

/**
 * @desc    Get single product by slug
 * @route   GET /api/products/:slug
 * @access  Public
 */
export const getProductBySlug = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;

  const product = await productService.getProductBySlug(slug);

  res.status(200).json({
    success: true,
    data: product,
  });
});

// ── Admin Controllers ──────────────────────────────────────────────────────────

/**
 * @desc    Get all products (any status) with pagination for admin panel
 * @route   GET /api/admin/products
 * @access  staff, admin, owner
 */
export const getAdminProducts = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, q, status } = req.query;

  const result = await productService.getAdminProducts({
    page: page as string,
    limit: limit as string,
    q: q as string,
    status: status as string,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Create a new product (validates category + SKU uniqueness)
 * @route   POST /api/admin/products
 * @access  staff, admin, owner
 */
export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, category, images, basePrice, discountPrice, variants, status } = req.body;

  const product = await productService.createProduct({
    name,
    description,
    category,
    images,
    basePrice,
    discountPrice: discountPrice ?? null,
    variants,
    status,
  });

  res.status(201).json({
    success: true,
    data: product,
    message: 'Product created successfully.',
  });
});

/**
 * @desc    Update product metadata + variants
 * @route   PATCH /api/admin/products/:id
 * @access  staff, admin, owner
 */
export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, category, images, basePrice, discountPrice, variants, status } = req.body;

  const product = await productService.updateProduct(id, {
    name,
    description,
    category,
    images,
    basePrice,
    discountPrice,
    variants,
    status,
  });

  res.status(200).json({
    success: true,
    data: product,
    message: 'Product updated successfully.',
  });
});

/**
 * @desc    Archive (soft-delete) a product — admin/owner only
 * @route   DELETE /api/admin/products/:id
 * @access  admin, owner
 */
export const archiveProduct = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const product = await productService.archiveProduct(id);

  res.status(200).json({
    success: true,
    data: product,
    message: 'Product archived successfully.',
  });
});
