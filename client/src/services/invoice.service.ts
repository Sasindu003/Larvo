import api, { ApiResponse } from './api';

export interface InvoiceItem {
  product: string;
  name: string;
  image: string;
  variantSku: string;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
}

export interface InvoiceAddress {
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

export interface InvoiceSnapshot {
  items: InvoiceItem[];
  shippingAddress: InvoiceAddress;
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  total: number;
  paymentStatus: 'submitted' | 'approved' | 'rejected';
  paymentMethod: 'bank_transfer' | 'simulated_online' | 'reward_points';
  pointsUsed?: number | null;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  order: string;
  user: string | { _id: string; name?: string; email?: string };
  snapshot: InvoiceSnapshot;
  issuedAt: string;
  createdAt: string;
  updatedAt: string;
}

export const invoiceService = {
  /**
   * Fetch invoice record for an order.
   */
  async getInvoiceByOrderId(orderId: string): Promise<Invoice> {
    const res = await api.get<ApiResponse<Invoice>>(`/invoices/${orderId}`);
    return (res as any).data;
  },

  /**
   * Get direct URL to the PDF stream endpoint.
   */
  getInvoicePdfUrl(orderId: string): string {
    const base = import.meta?.env?.VITE_API_URL || 'http://localhost:5000/api';
    return `${base}/invoices/${orderId}/pdf`;
  },

  /**
   * Trigger authenticated browser download of invoice PDF via blob URL.
   */
  async downloadInvoicePdf(orderId: string, invoiceNumber?: string): Promise<void> {
    const response = await api.get(`/invoices/${orderId}/pdf`, {
      responseType: 'blob',
    });
    const blob = new Blob([response as any], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoiceNumber || `INV-${orderId.slice(-8).toUpperCase()}`}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default invoiceService;
