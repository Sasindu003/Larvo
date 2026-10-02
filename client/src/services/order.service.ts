import api, { ApiResponse } from './api';
import { AxiosProgressEvent } from 'axios';

export interface OrderItemInput {
  productId: string;
  variantSku: string;
  quantity: number;
}

export interface CreateOrderPayload {
  items: OrderItemInput[];
  shippingAddressId: string;
  couponCode?: string;
}

export interface OrderItem {
  productId: string;
  variantSku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  image?: string;
  size?: string;
  color?: string;
  slug?: string;
}

export type OrderStatus =
  | 'pending_payment'
  | 'payment_review'
  | 'confirmed'
  | 'processing'
  | 'ready_for_dispatch'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface Order {
  _id: string;
  user: string;
  orderNumber?: string;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  discountAmount?: number;
  discountTotal: number;
  total: number;
  pointsPaid: number;
  status: OrderStatus;
  trackingNumber?: string | null;
  deliveredAt?: string | null;
  shippingAddress: {
    label?: string;
    line1: string;
    line2?: string;
    city: string;
    province?: string;
    postalCode: string;
    country: string;
  };
  couponCode?: string | null;
  coupon?: {
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    discountAmount: number;
  };
  payment?: Payment | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderUser {
  _id: string;
  name: string;
  email: string;
}

export interface AdminOrder extends Omit<Order, 'user'> {
  user: AdminOrderUser | string;
}

export interface Payment {
  _id: string;
  order: string;
  method: 'bank_transfer' | 'simulated_online' | 'reward_points';
  status: 'submitted' | 'approved' | 'rejected';
  amount: number;
  pointsUsed?: number;
  slipImageUrl?: string;
  transactionId?: string;
  maskedCardLast4?: string;
  gatewayResponseCode?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderResult {
  order: Order;
  couponWarning?: string | null;
}

export interface WalletPaymentResult {
  order: Order;
  payment: Payment;
  pointsDeducted: number;
}

export interface SlipPaymentResult {
  order: Order;
  payment: Payment;
}

export interface SimulatePaymentPayload {
  cardNumber: string;
  expiry: string;
  cvv: string;
  cardholderName: string;
}

export interface SimulatePaymentResult {
  order: Order;
  payment: Payment;
  approved: boolean;
}

export interface PaginatedOrdersResult {
  orders: Order[];
  results: number;
  total: number;
  page: number;
  pages: number;
}

export interface AdminOrdersResult {
  orders: AdminOrder[];
  results: number;
  total: number;
  page: number;
  pages: number;
}

export const orderService = {
  async createOrder(payload: CreateOrderPayload): Promise<CreateOrderResult> {
    const res = await api.post<ApiResponse<CreateOrderResult>>('/orders', payload);
    return (res as any).data;
  },

  async payWithWallet(orderId: string): Promise<WalletPaymentResult> {
    const res = await api.post<ApiResponse<WalletPaymentResult>>(`/orders/${orderId}/payment/wallet`);
    return (res as any).data;
  },

  async uploadPaymentSlip(
    orderId: string,
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<SlipPaymentResult> {
    const formData = new FormData();
    formData.append('slip', file);

    const res = await api.post<ApiResponse<SlipPaymentResult>>(
      `/orders/${orderId}/payment/slip`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          if (progressEvent.total && onProgress) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percent);
          }
        },
      }
    );
    return (res as any).data;
  },

  async simulatePayment(
    orderId: string,
    payload: SimulatePaymentPayload
  ): Promise<SimulatePaymentResult> {
    const res = await api.post<ApiResponse<SimulatePaymentResult>>(
      `/orders/${orderId}/payment/simulate`,
      payload
    );
    return (res as any).data;
  },

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    trackingNumber?: string
  ): Promise<{ order: Order }> {
    const res = await api.patch<ApiResponse<{ order: Order }>>(
      `/orders/${orderId}/status`,
      { status, trackingNumber }
    );
    return (res as any).data;
  },

  async getMyOrders(params?: { page?: number; limit?: number }): Promise<PaginatedOrdersResult> {
    const res = await api.get<ApiResponse<PaginatedOrdersResult>>('/orders/me', { params });
    return (res as any).data;
  },

  async getOrderById(orderId: string): Promise<{ order: Order }> {
    const res = await api.get<ApiResponse<{ order: Order }>>(`/orders/${orderId}`);
    return (res as any).data;
  },

  async cancelOrder(orderId: string): Promise<{ order: Order }> {
    const res = await api.patch<ApiResponse<{ order: Order }>>(`/orders/${orderId}/cancel`);
    return (res as any).data;
  },

  async getAdminOrders(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<AdminOrdersResult> {
    const res = await api.get<ApiResponse<AdminOrdersResult>>('/admin/orders', { params });
    return (res as any).data;
  },

  async getAdminOrderById(orderId: string): Promise<{ order: AdminOrder }> {
    const res = await api.get<ApiResponse<{ order: AdminOrder }>>(`/admin/orders/${orderId}`);
    return (res as any).data;
  },

  async reviewPayment(
    paymentId: string,
    decision: 'approved' | 'rejected',
    note?: string
  ): Promise<{ payment: Payment; order: Order }> {
    const res = await api.patch<ApiResponse<{ payment: Payment; order: Order }>>(
      `/admin/payments/${paymentId}/review`,
      { decision, note }
    );
    return (res as any).data;
  },

  async getDeliveryOrders(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<DeliveryOrdersResult> {
    const res = await api.get<ApiResponse<DeliveryOrdersResult>>('/delivery/orders', { params });
    return (res as any).data;
  },

  async updateOrderTracking(
    orderId: string,
    trackingNumber: string
  ): Promise<{ order: AdminOrder }> {
    const res = await api.patch<ApiResponse<{ order: AdminOrder }>>(
      `/orders/${orderId}/tracking`,
      { trackingNumber }
    );
    return (res as any).data;
  },
};

export interface DeliveryOrdersResult {
  orders: AdminOrder[];
  results: number;
  total: number;
  page: number;
  pages: number;
}


