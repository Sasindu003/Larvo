import api, { ApiResponse } from './api';

export type ReturnStatus =
  | 'requested'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'pickup_scheduled'
  | 'picked_up'
  | 'received'
  | 'refunded';

export interface IReturnItem {
  orderItemRef: number;
  sku: string;
  qty: number;
  reason: string;
}

export interface IReturnRequest {
  _id: string;
  order: string | any;
  user: string | any;
  items: IReturnItem[];
  status: ReturnStatus;
  rejectionReason: string | null;
  estimatedRefundPoints?: number | null;
  refundPoints: number | null;
  refundMethod: 'wallet_points' | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReturnItemInput {
  orderItemRef: number;
  qty: number;
  reason: string;
}

export interface CreateReturnRequestInput {
  orderId: string;
  items: CreateReturnItemInput[];
}

export interface GetMyReturnsResponse {
  results: IReturnRequest[];
  total: number;
  page: number;
  pages: number;
}

export interface GetAdminReturnsParams {
  page?: number;
  limit?: number;
  status?: ReturnStatus;
  userId?: string;
}

export interface GetAdminReturnsResponse {
  results: IReturnRequest[];
  total: number;
  page: number;
  pages: number;
}

export interface ProcessDecisionInput {
  decision: 'approved' | 'rejected';
  rejectionReason?: string;
}

export const returnService = {
  createReturn: async (data: CreateReturnRequestInput): Promise<IReturnRequest> => {
    const res = await api.post<any, ApiResponse<{ returnRequest: IReturnRequest }>>('/returns', data);
    return res.data!.returnRequest;
  },

  getMyReturns: async (params?: { page?: number; limit?: number; orderId?: string }): Promise<GetMyReturnsResponse> => {
    const res = await api.get<any, ApiResponse<GetMyReturnsResponse>>('/returns/me', { params });
    return res.data!;
  },

  getReturnById: async (id: string): Promise<IReturnRequest> => {
    const res = await api.get<any, ApiResponse<{ returnRequest: IReturnRequest }>>(`/returns/${id}`);
    return res.data!.returnRequest;
  },

  getReturnByOrderId: async (orderId: string): Promise<IReturnRequest | null> => {
    try {
      const res = await api.get<any, ApiResponse<{ returnRequest: IReturnRequest }>>(`/returns/order/${orderId}`);
      return res.data?.returnRequest || null;
    } catch {
      return null;
    }
  },

  getAdminReturns: async (params?: GetAdminReturnsParams): Promise<GetAdminReturnsResponse> => {
    const res = await api.get<any, ApiResponse<GetAdminReturnsResponse>>('/admin/returns', { params });
    return res.data!;
  },

  processDecision: async (id: string, data: ProcessDecisionInput): Promise<IReturnRequest> => {
    const res = await api.patch<any, ApiResponse<{ returnRequest: IReturnRequest }>>(`/admin/returns/${id}/decision`, data);
    return res.data!.returnRequest;
  },

  getDeliveryReturns: async (params?: {
    page?: number;
    limit?: number;
    status?: 'pickup_scheduled' | 'picked_up';
  }): Promise<GetAdminReturnsResponse> => {
    const res = await api.get<any, ApiResponse<GetAdminReturnsResponse>>('/delivery/returns', { params });
    return res.data!;
  },

  advanceDeliveryReturnStatus: async (
    id: string,
    status: 'picked_up' | 'received'
  ): Promise<IReturnRequest> => {
    const res = await api.patch<any, ApiResponse<{ returnRequest: IReturnRequest }>>(
      `/delivery/returns/${id}/status`,
      { status }
    );
    return res.data!.returnRequest;
  },

  processAdminRefund: async (id: string): Promise<IReturnRequest> => {
    const res = await api.patch<any, ApiResponse<{ returnRequest: IReturnRequest }>>(
      `/admin/returns/${id}/refund`
    );
    return res.data!.returnRequest;
  },
};

export default returnService;
