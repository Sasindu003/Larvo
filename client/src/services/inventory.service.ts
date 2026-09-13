import api, { ApiResponse } from './api';

export interface InventoryValidationRequest {
  sku: string;
  qty: number;
}

export interface InventoryValidationResponse {
  sku: string;
  ok: boolean;
  available?: number;
  shortfall?: number;
}

export interface AdminInventoryProductInfo {
  _id: string;
  name: string;
  slug: string;
  image?: string;
}

export interface AdminInventorySupplierInfo {
  _id: string;
  name: string;
  companyName: string;
  status?: string;
}

export interface AdminInventoryItem {
  product: AdminInventoryProductInfo;
  sku: string;
  size: string;
  color: string;
  stock: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  supplier?: AdminInventorySupplierInfo | null;
}

export interface AdminInventoryResponse {
  items: AdminInventoryItem[];
  total: number;
  page: number;
  pages: number;
  results: number;
}

export interface GetAdminInventoryParams {
  search?: string;
  status?: 'low_stock' | 'out_of_stock' | '';
  supplier?: string;
  page?: number;
  limit?: number;
}

export const inventoryService = {
  validate: async (items: InventoryValidationRequest[]): Promise<InventoryValidationResponse[]> => {
    const res = await api.post<ApiResponse<InventoryValidationResponse[]>>('/inventory/validate', items);
    return (res as any).data || (res as any);
  },

  getAdminInventory: async (params?: GetAdminInventoryParams): Promise<AdminInventoryResponse> => {
    const res = await api.get<ApiResponse<AdminInventoryResponse>>('/admin/inventory', { params });
    return (res as any).data || (res as any);
  },

  adjustStock: async (sku: string, stock: number): Promise<{ sku: string; stock: number; status: string }> => {
    const res = await api.patch<ApiResponse<{ sku: string; stock: number; status: string }>>(
      `/admin/inventory/${encodeURIComponent(sku)}/adjust`,
      { stock }
    );
    return (res as any).data || (res as any);
  },
};
