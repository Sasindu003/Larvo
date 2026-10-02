import api, { ApiResponse } from './api';
import { Category } from './category.service';

export interface ProductVariant {
  _id?: string;
  size: 'XS' | 'S' | 'M' | 'L' | 'XL';
  color: string;
  material: string;
  sku: string;
  stock: number;
  supplier?: { _id: string; name: string; companyName: string; status?: string } | string | null;
}

export interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  category: Category | string;
  images: string[];
  basePrice: number;
  discountPrice: number | null;
  ratingAvg: number;
  ratingCount: number;
  variants: ProductVariant[];
  status: 'active' | 'draft' | 'archived';
  inStock?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface GetProductsParams {
  page?: number;
  limit?: number;
  department?: string;
  category?: string;
  sort?: string;
  q?: string;
  minPrice?: string | number;
  maxPrice?: string | number;
  size?: string;
  color?: string;
  inStock?: string | boolean;
}

export interface PaginatedProductsResponse {
  items: Product[];
  results: number;
  total: number;
  page: number;
  pages: number;
}

export interface CreateProductDto {
  name: string;
  description: string;
  category: string;
  images: string[];
  basePrice: number;
  discountPrice?: number | null;
  variants: Omit<ProductVariant, '_id'>[];
  status?: 'active' | 'draft' | 'archived';
}

export interface UpdateProductDto {
  name?: string;
  description?: string;
  category?: string;
  images?: string[];
  basePrice?: number;
  discountPrice?: number | null;
  variants?: Omit<ProductVariant, '_id'>[];
  status?: 'active' | 'draft' | 'archived';
}

export const productService = {
  /**
   * Fetch paginated list of active products with optional search query, category, and sort
   */
  async getProducts(params?: GetProductsParams): Promise<PaginatedProductsResponse> {
    const res = await api.get<ApiResponse<PaginatedProductsResponse>>('/products', {
      params,
    });
    return (res as any).data || (res as any);
  },

  /**
   * Fetch lightweight top 5 search suggestions for autosuggest dropdown
   */
  async getSuggestions(q: string): Promise<Product[]> {
    if (!q || !q.trim()) return [];
    const res = await api.get<ApiResponse<Product[]>>('/products/suggest', {
      params: { q: q.trim() },
    });
    return (res as any).data || (res as any);
  },

  /**
   * Fetch single product detail by slug
   */
  async getProductBySlug(slug: string): Promise<Product> {
    const res = await api.get<ApiResponse<Product>>(`/products/${slug}`);
    return (res as any).data || (res as any);
  },

  // ── Admin endpoints ────────────────────────────────────────────────────────

  /**
   * Admin: fetch all products (any status) with optional search + status filter
   */
  async getAdminProducts(params?: {
    page?: number;
    limit?: number;
    q?: string;
    status?: string;
  }): Promise<PaginatedProductsResponse> {
    const res = await api.get<ApiResponse<PaginatedProductsResponse>>('/admin/products', {
      params,
    });
    return (res as any).data || (res as any);
  },

  /**
   * Admin: create a new product
   */
  async createProduct(data: CreateProductDto): Promise<Product> {
    const res = await api.post<ApiResponse<Product>>('/admin/products', data);
    return (res as any).data || (res as any);
  },

  /**
   * Admin: update product by ID
   */
  async updateProduct(id: string, data: UpdateProductDto): Promise<Product> {
    const res = await api.patch<ApiResponse<Product>>(`/admin/products/${id}`, data);
    return (res as any).data || (res as any);
  },

  /**
   * Admin/Owner: archive a product (soft delete)
   */
  async archiveProduct(id: string): Promise<Product> {
    const res = await api.delete<ApiResponse<Product>>(`/admin/products/${id}`);
    return (res as any).data || (res as any);
  },
};

export default productService;
