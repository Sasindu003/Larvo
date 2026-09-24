import api, { ApiResponse } from './api';
import { ISupplier } from './supplier.service';

export type POStatus =
  | 'draft'
  | 'submitted'
  | 'confirmed'
  | 'in_transit'
  | 'partially_received'
  | 'received'
  | 'cancelled';

export const PO_STATUSES: POStatus[] = [
  'draft',
  'submitted',
  'confirmed',
  'in_transit',
  'partially_received',
  'received',
  'cancelled',
];

export const PO_VALID_TRANSITIONS: Record<POStatus, POStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['confirmed', 'cancelled'],
  confirmed: ['in_transit', 'cancelled'],
  in_transit: ['partially_received', 'received'],
  partially_received: ['received'],
  received: [],
  cancelled: [],
};

export interface IPOItemProduct {
  _id: string;
  name: string;
  slug: string;
  images?: string[];
  basePrice: number;
}

export interface IPOItem {
  _id?: string;
  product: IPOItemProduct | string;
  sku: string;
  size: string;
  color: string;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
}

export type SupplierResponseDecision = 'pending' | 'accepted' | 'declined';

export interface ISupplierResponseItem {
  poItemId: string;
  canSupplyQty: number;
  unitPrice: number;
}

export interface ISupplierResponse {
  decision: SupplierResponseDecision;
  respondedAt?: string | null;
  items: ISupplierResponseItem[];
  estimatedDeliveryDate?: string | null;
  notes?: string;
}

export interface SupplierRespondPayload {
  decision: 'accepted' | 'declined';
  items?: {
    poItemId: string;
    canSupplyQty: number;
    unitPrice: number;
  }[];
  estimatedDeliveryDate?: string | null;
  notes?: string;
}

export interface IPurchaseOrder {
  _id: string;
  supplier: ISupplier | string;
  items: IPOItem[];
  status: POStatus;
  expectedDeliveryDate?: string | null;
  notes?: string;
  supplierResponse?: ISupplierResponse;
  totalCost: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePOItemInput {
  product: string;
  sku: string;
  size: string;
  color: string;
  orderedQty: number;
  receivedQty?: number;
  unitCost: number;
}

export interface CreatePOInput {
  supplier: string;
  items: CreatePOItemInput[];
  expectedDeliveryDate?: string | null;
  notes?: string;
}

export interface UpdatePOInput {
  supplier?: string;
  items?: CreatePOItemInput[];
  expectedDeliveryDate?: string | null;
  notes?: string;
}

export interface GetPurchaseOrdersParams {
  page?: number;
  limit?: number;
  status?: string;
  supplier?: string;
  search?: string;
}

export interface GetPurchaseOrdersResponse {
  results: IPurchaseOrder[];
  total: number;
  page: number;
  pages: number;
}

export const purchaseOrderService = {
  getPurchaseOrders: async (params?: GetPurchaseOrdersParams): Promise<GetPurchaseOrdersResponse> => {
    const res = await api.get<any, ApiResponse<GetPurchaseOrdersResponse>>('/admin/purchase-orders', { params });
    return res.data!;
  },

  getPurchaseOrderById: async (id: string): Promise<IPurchaseOrder> => {
    const res = await api.get<any, ApiResponse<{ purchaseOrder: IPurchaseOrder }>>(`/admin/purchase-orders/${id}`);
    return res.data!.purchaseOrder;
  },

  createPurchaseOrder: async (data: CreatePOInput): Promise<IPurchaseOrder> => {
    const res = await api.post<any, ApiResponse<{ purchaseOrder: IPurchaseOrder }>>('/admin/purchase-orders', data);
    return res.data!.purchaseOrder;
  },

  updatePurchaseOrder: async (id: string, data: UpdatePOInput): Promise<IPurchaseOrder> => {
    const res = await api.patch<any, ApiResponse<{ purchaseOrder: IPurchaseOrder }>>(`/admin/purchase-orders/${id}`, data);
    return res.data!.purchaseOrder;
  },

  advanceStatus: async (id: string, status: POStatus): Promise<IPurchaseOrder> => {
    const res = await api.patch<any, ApiResponse<{ purchaseOrder: IPurchaseOrder }>>(`/admin/purchase-orders/${id}/status`, { status });
    return res.data!.purchaseOrder;
  },

  cancelPurchaseOrder: async (id: string): Promise<IPurchaseOrder> => {
    const res = await api.patch<any, ApiResponse<{ purchaseOrder: IPurchaseOrder }>>(`/admin/purchase-orders/${id}/cancel`);
    return res.data!.purchaseOrder;
  },

  receivePurchaseOrder: async (
    id: string,
    lines: { sku: string; receivedQtyDelta: number }[]
  ): Promise<IPurchaseOrder> => {
    const res = await api.patch<any, ApiResponse<{ purchaseOrder: IPurchaseOrder }>>(
      `/admin/purchase-orders/${id}/receive`,
      { lines }
    );
    return res.data!.purchaseOrder;
  },
};

export default purchaseOrderService;
