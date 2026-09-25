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
  userId?: string;
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
  createAccount?: boolean;
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

export interface SupplierAccountResult {
  supplier: ISupplier;
  credentials: {
    email: string;
    tempPassword: string;
  };
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

  createSupplier: async (data: CreateSupplierInput): Promise<{ supplier: ISupplier; credentials?: { email: string; tempPassword: string } }> => {
    const res = await api.post<any, ApiResponse<{ supplier: ISupplier; credentials?: { email: string; tempPassword: string } }>>('/admin/suppliers', data);
    return res.data!;
  },

  updateSupplier: async (id: string, data: UpdateSupplierInput): Promise<ISupplier> => {
    const res = await api.patch<any, ApiResponse<{ supplier: ISupplier }>>(`/admin/suppliers/${id}`, data);
    return res.data!.supplier;
  },

  deactivateSupplier: async (id: string): Promise<ISupplier> => {
    const res = await api.patch<any, ApiResponse<{ supplier: ISupplier }>>(`/admin/suppliers/${id}/deactivate`);
    return res.data!.supplier;
  },

  createSupplierAccount: async (id: string): Promise<SupplierAccountResult> => {
    const res = await api.post<any, ApiResponse<SupplierAccountResult>>(`/admin/suppliers/${id}/create-account`);
    return res.data!;
  },

  getSupplierProducts: async (id: string): Promise<SupplierProductsResponse> => {
    const res = await api.get<any, ApiResponse<SupplierProductsResponse>>(`/admin/suppliers/${id}/products`);
    return res.data!;
  },

  deleteSupplier: async (id: string): Promise<void> => {
    await api.delete<any, ApiResponse<null>>(`/admin/suppliers/${id}`);
  },
};

export const supplierPortalService = {
  getMe: async (): Promise<{ supplier: ISupplier; user: { _id: string; name: string; email: string; role: string } }> => {
    const res = await api.get<any, ApiResponse<{ supplier: ISupplier; user: any }>>('/supplier/me');
    return res.data!;
  },

  getPurchaseOrders: async (params?: { page?: number; limit?: number; status?: string }): Promise<any> => {
    const res = await api.get<any, ApiResponse<any>>('/supplier/purchase-orders', { params });
    return res.data!;
  },

  getPurchaseOrderById: async (id: string): Promise<any> => {
    const res = await api.get<any, ApiResponse<{ purchaseOrder: any }>>(`/supplier/purchase-orders/${id}`);
    return res.data!.purchaseOrder;
  },

  getProducts: async (): Promise<SupplierProductsResponse> => {
    const res = await api.get<any, ApiResponse<SupplierProductsResponse>>('/supplier/products');
    return res.data!;
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }): Promise<any> => {
    const res = await api.patch<any, ApiResponse<any>>('/supplier/change-password', data);
    return res;
  },

  respondPurchaseOrder: async (
    id: string,
    data: {
      action: 'confirm' | 'reject';
      rejectionReason?: string;
      estimatedDeliveryDate?: string | null;
      supplierNotes?: string;
      items?: { sku: string; quotedQty: number; unitCost?: number }[];
    }
  ): Promise<any> => {
    const res = await api.patch<any, ApiResponse<{ purchaseOrder: any }>>(
      `/supplier/purchase-orders/${id}/respond`,
      data
    );
    return res.data!.purchaseOrder;
  },

  dispatchPurchaseOrder: async (
    id: string,
    data: { carrier?: string; trackingNumber?: string }
  ): Promise<any> => {
    const res = await api.patch<any, ApiResponse<{ purchaseOrder: any }>>(
      `/supplier/purchase-orders/${id}/dispatch`,
      data
    );
    return res.data!.purchaseOrder;
  },
};

export default supplierService;
