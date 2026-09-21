import api, { ApiResponse } from './api';

export interface AnalyticsSummary {
  orderCount: number;
  revenue: number;
  averageOrderValue: number;
}

export interface RevenueTrendPoint {
  date: string;
  revenue: number;
  orderCount: number;
}

export interface TopProductMetric {
  productId: string;
  name: string;
  unitsSold: number;
  revenue: number;
}

export interface InventoryAlertItem {
  product: {
    _id: string;
    name: string;
    slug: string;
    image?: string;
  };
  sku: string;
  size: string;
  color: string;
  stock: number;
  status: 'low_stock' | 'out_of_stock';
}

export interface InventoryAlertsData {
  lowStock: InventoryAlertItem[];
  outOfStock: InventoryAlertItem[];
  lowStockCount: number;
  outOfStockCount: number;
}

export interface CustomerGrowthPoint {
  date: string;
  newCustomers: number;
}

export interface WalletSummaryMetrics {
  totalOutstandingPoints: number;
  totalPointsIssued: number;
  totalPointsRedeemed: number;
  refundPointsIssued: number;
  orderPointsRedeemed: number;
  adminCreditPoints: number;
  adminDebitPoints: number;
  reversalPoints: number;
  activeWalletsCount: number;
  totalWalletsCount: number;
}

export const analyticsService = {
  /**
   * Get order summary metrics (order count, total revenue, average order value)
   */
  async getSummary(params?: { from?: string; to?: string }): Promise<AnalyticsSummary> {
    const res = (await api.get<ApiResponse<AnalyticsSummary>>('/admin/analytics/summary', {
      params,
    })) as unknown as ApiResponse<AnalyticsSummary>;
    return res.data!;
  },

  /**
   * Get revenue trend time-series points
   */
  async getRevenueTrend(params?: {
    from?: string;
    to?: string;
    granularity?: 'day' | 'week' | 'month';
  }): Promise<RevenueTrendPoint[]> {
    const res = (await api.get<ApiResponse<RevenueTrendPoint[]>>(
      '/admin/analytics/revenue-trend',
      {
        params,
      }
    )) as unknown as ApiResponse<RevenueTrendPoint[]>;
    return res.data!;
  },

  /**
   * Get top selling products ranked by revenue
   */
  async getTopProducts(params?: {
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<TopProductMetric[]> {
    const res = (await api.get<ApiResponse<TopProductMetric[]>>('/admin/analytics/top-products', {
      params,
    })) as unknown as ApiResponse<TopProductMetric[]>;
    return res.data!;
  },

  /**
   * Get low-stock and out-of-stock variant alert lists
   */
  async getInventoryAlerts(): Promise<InventoryAlertsData> {
    const res = (await api.get<ApiResponse<InventoryAlertsData>>(
      '/admin/analytics/inventory-alerts'
    )) as unknown as ApiResponse<InventoryAlertsData>;
    return res.data!;
  },

  /**
   * Get customer account acquisition growth
   */
  async getCustomerGrowth(params?: {
    from?: string;
    to?: string;
    granularity?: 'day' | 'week' | 'month';
  }): Promise<CustomerGrowthPoint[]> {
    const res = (await api.get<ApiResponse<CustomerGrowthPoint[]>>(
      '/admin/analytics/customer-growth',
      {
        params,
      }
    )) as unknown as ApiResponse<CustomerGrowthPoint[]>;
    return res.data!;
  },

  /**
   * Get total outstanding reward points, lifetime issued, and lifetime redeemed
   */
  async getWalletSummary(): Promise<WalletSummaryMetrics> {
    const res = (await api.get<ApiResponse<WalletSummaryMetrics>>(
      '/admin/analytics/wallet-summary'
    )) as unknown as ApiResponse<WalletSummaryMetrics>;
    return res.data!;
  },
};

export default analyticsService;
