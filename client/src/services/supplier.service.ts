import api, { ApiResponse } from './api';

export type SupplierStatus = 'active' | 'inactive';

export interface ISupplier {
  _id: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  address?: string;
  status: SupplierStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierInput {
  name: string;
  companyName: string;
  email: string;
  phone: string;
  address?: string;
  notes?: string;
}

export interface UpdateSupplierInput {
  name?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: SupplierStatus;
  notes?: string;
}

export interface GetSuppliersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'all' | 'active' | 'inactive';
}

export interface GetSuppliersResponse {
  results: ISupplier[];
  total: number;
  page: number;
  pages: number;
}

export interface SupplierProductVariant {
  size: string;
  color: string;
  material: string;
  sku: string;
  stock: number;
}

export interface SupplierProductItem {
  _id: string;
  name: string;
  slug: string;
  images: string[];
  category?: { _id: string; name: string; slug: string };
  basePrice: number;
  status: string;
  variants: SupplierProductVariant[];
}

export interface SupplierProductsResponse {
  supplier: ISupplier;
  products: SupplierProductItem[];
  totalProducts: number;
  totalVariants: number;
}

export const supplierService = {
  getSuppliers: async (params?: GetSuppliersParams): Promise<GetSuppliersResponse> => {
    const res = await api.get<any, ApiResponse<GetSuppliersResponse>>('/admin/suppliers', { params });
    return res.data!;
  },

  getSupplierById: async (id: string): Promise<ISupplier> => {
    const res = await api.get<any, ApiResponse<{ supplier: ISupplier }>>(`/admin/suppliers/${id}`);
    return res.data!.supplier;
  },

  createSupplier: async (data: CreateSupplierInput): Promise<ISupplier> => {
    const res = await api.post<any, ApiResponse<{ supplier: ISupplier }>>('/admin/suppliers', data);
    return res.data!.supplier;
  },

  updateSupplier: async (id: string, data: UpdateSupplierInput): Promise<ISupplier> => {
    const res = await api.patch<any, ApiResponse<{ supplier: ISupplier }>>(`/admin/suppliers/${id}`, data);
    return res.data!.supplier;
  },

  deactivateSupplier: async (id: string): Promise<ISupplier> => {
    const res = await api.patch<any, ApiResponse<{ supplier: ISupplier }>>(`/admin/suppliers/${id}/deactivate`);
    return res.data!.supplier;
  },

  getSupplierProducts: async (id: string): Promise<SupplierProductsResponse> => {
    const res = await api.get<any, ApiResponse<SupplierProductsResponse>>(`/admin/suppliers/${id}/products`);
    return res.data!;
  },

  deleteSupplier: async (id: string): Promise<void> => {
    await api.delete<any, ApiResponse<null>>(`/admin/suppliers/${id}`);
  },
};

export default supplierService;
