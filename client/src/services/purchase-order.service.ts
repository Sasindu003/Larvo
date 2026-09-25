import api, { ApiResponse } from './api';
import { ISupplier } from './supplier.service';

export type POStatus =
  | 'requested'
  | 'quoted'
  | 'declined'
  | 'admin_approved'
  | 'admin_rejected'
  | 'payment_submitted'
  | 'payment_rejected'
  | 'confirmed'
  | 'in_transit'
  | 'partially_received'
  | 'received'
  | 'cancelled';

export const PO_STATUSES: POStatus[] = [
  'requested',
  'quoted',
  'declined',
  'admin_approved',
  'admin_rejected',
  'payment_submitted',
  'payment_rejected',
  'confirmed',
  'in_transit',
  'partially_received',
  'received',
  'cancelled',
];

export const PO_VALID_TRANSITIONS: Record<POStatus, POStatus[]> = {
  requested: ['quoted', 'declined', 'cancelled'],
  quoted: ['admin_approved', 'admin_rejected'],
  declined: [],
  admin_approved: ['payment_submitted', 'cancelled'],
  admin_rejected: ['cancelled'],
  payment_submitted: ['confirmed', 'payment_rejected'],
  payment_rejected: ['payment_submitted', 'cancelled'],
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
  quotedQty: number;
  quotedUnitCost: number;
}

export interface IPurchaseOrder {
  _id: string;
  supplier: ISupplier | string;
  items: IPOItem[];
  status: POStatus;
  estimatedDeliveryDate?: string | null;
  paymentSlipUrl?: string | null;
  paymentReviewNote?: string | null;
  declineReason?: string | null;
  notes?: string;
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
  unitCost?: number;
  quotedQty?: number;
  quotedUnitCost?: number;
}

export interface CreatePOInput {
  supplier: string;
  items: CreatePOItemInput[];
  estimatedDeliveryDate?: string | null;
  paymentSlipUrl?: string | null;
  paymentReviewNote?: string | null;
  declineReason?: string | null;
  notes?: string;
}

export interface UpdatePOInput {
  supplier?: string;
  items?: CreatePOItemInput[];
  estimatedDeliveryDate?: string | null;
  paymentSlipUrl?: string | null;
  paymentReviewNote?: string | null;
  declineReason?: string | null;
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

export interface SubmitQuoteLineInput {
  sku: string;
  quotedQty: number;
  quotedUnitCost: number;
}

export interface SubmitQuoteInput {
  lines: SubmitQuoteLineInput[];
  estimatedDeliveryDate?: string | null;
}

export interface DeclinePOInput {
  declineReason: string;
}

export interface ReviewPaymentInput {
  decision: 'approve' | 'reject';
  note?: string;
}

export interface SkuSearchResult {
  productId: string;
  name: string;
  sku: string;
  size: string;
  color: string;
  currentStock: number;
}

export const purchaseOrderService = {
  searchSku: async (q: string): Promise<SkuSearchResult[]> => {
    const res = await api.get<any, ApiResponse<SkuSearchResult[]>>('/admin/inventory/search-sku', {
      params: { q },
    });
    return res.data || [];
  },

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

  // Supplier Portal methods
  getSupplierPurchaseOrders: async (params?: GetPurchaseOrdersParams): Promise<GetPurchaseOrdersResponse> => {
    const res = await api.get<any, ApiResponse<GetPurchaseOrdersResponse>>('/supplier/purchase-orders', { params });
    return res.data!;
  },

  getSupplierPurchaseOrderById: async (id: string): Promise<IPurchaseOrder> => {
    const res = await api.get<any, ApiResponse<{ purchaseOrder: IPurchaseOrder }>>(`/supplier/purchase-orders/${id}`);
    return res.data!.purchaseOrder;
  },

  submitQuote: async (id: string, data: SubmitQuoteInput): Promise<IPurchaseOrder> => {
    const res = await api.patch<any, ApiResponse<{ purchaseOrder: IPurchaseOrder }>>(
      `/supplier/purchase-orders/${id}/quote`,
      data
    );
    return res.data!.purchaseOrder;
  },

  decideQuote: async (id: string, decision: 'approve' | 'reject'): Promise<IPurchaseOrder> => {
    const res = await api.patch<any, ApiResponse<{ purchaseOrder: IPurchaseOrder }>>(
      `/admin/purchase-orders/${id}/decide-quote`,
      { decision }
    );
    return res.data!.purchaseOrder;
  },

  submitPaymentSlip: async (id: string, file: File): Promise<IPurchaseOrder> => {
    const formData = new FormData();
    formData.append('slip', file);
    const res = await api.patch<any, ApiResponse<{ purchaseOrder: IPurchaseOrder }>>(
      `/admin/purchase-orders/${id}/payment-slip`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return res.data!.purchaseOrder;
  },

  declinePurchaseOrder: async (id: string, data: DeclinePOInput): Promise<IPurchaseOrder> => {
    const res = await api.patch<any, ApiResponse<{ purchaseOrder: IPurchaseOrder }>>(
      `/supplier/purchase-orders/${id}/decline`,
      data
    );
    return res.data!.purchaseOrder;
  },

  reviewPayment: async (id: string, data: ReviewPaymentInput): Promise<IPurchaseOrder> => {
    const res = await api.patch<any, ApiResponse<{ purchaseOrder: IPurchaseOrder }>>(
      `/supplier/purchase-orders/${id}/review-payment`,
      data
    );
    return res.data!.purchaseOrder;
  },

  markShipped: async (id: string): Promise<IPurchaseOrder> => {
    const res = await api.patch<any, ApiResponse<{ purchaseOrder: IPurchaseOrder }>>(
      `/supplier/purchase-orders/${id}/ship`
    );
    return res.data!.purchaseOrder;
  },
};

export default purchaseOrderService;
