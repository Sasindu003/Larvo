import api, { ApiResponse } from './api';
import { Department } from './department.service';

export interface Category {
  _id: string;
  name: string;
  slug: string;
  image: string;
  active?: boolean;
  department?: Department | {
    _id: string;
    name: string;
    slug: string;
    image?: string;
    active?: boolean;
  } | string;
  parent?: {
    _id: string;
    name: string;
    slug: string;
  } | string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCategoryDto {
  name: string;
  slug?: string;
  image: string;
  department: string;
  parent?: string | null;
  active?: boolean;
}

export interface UpdateCategoryDto {
  name?: string;
  slug?: string;
  image?: string;
  department?: string;
  parent?: string | null;
  active?: boolean;
}

export const categoryService = {
  /**
   * Fetch all categories (public active only by default; all if includeInactive=true)
   */
  async getCategories(includeInactive: boolean = false): Promise<Category[]> {
    const url = includeInactive ? '/categories?includeInactive=true' : '/categories';
    const res = await api.get<ApiResponse<Category[]>>(url);
    return (res as any).data || (res as any);
  },

  /**
   * Create category (Admin/Owner)
   */
  async createCategory(data: CreateCategoryDto): Promise<Category> {
    const res = await api.post<ApiResponse<Category>>('/categories', data);
    return (res as any).data || (res as any);
  },

  /**
   * Update category (Admin/Owner)
   */
  async updateCategory(id: string, data: UpdateCategoryDto): Promise<Category> {
    const res = await api.patch<ApiResponse<Category>>(`/categories/${id}`, data);
    return (res as any).data || (res as any);
  },

  /**
   * Deactivate category (Admin/Owner)
   */
  async deactivateCategory(id: string): Promise<Category> {
    const res = await api.patch<ApiResponse<Category>>(`/categories/${id}/deactivate`);
    return (res as any).data || (res as any);
  },
};

export default categoryService;
