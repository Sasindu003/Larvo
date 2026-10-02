import { Order } from '../models/Order';
import { User } from '../models/User';
import { Wallet } from '../models/Wallet';
import { PointsTransaction } from '../models/PointsTransaction';
import { inventoryService } from './inventory.service';
import { Granularity } from '../validators/analytics.validator';

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
  productId: any;
  name: string;
  unitsSold: number;
  revenue: number;
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

function getDateFormatString(granularity: Granularity): string {
  switch (granularity) {
    case 'week':
      return '%G-W%V';
    case 'month':
      return '%Y-%m';
    case 'day':
    default:
      return '%Y-%m-%d';
  }
}

export const analyticsService = {
  /**
   * Aggregate order summary (order count, total revenue, average order value)
   * in the specified date range, excluding cancelled orders.
   */
  async getSummary(from: Date, to: Date): Promise<AnalyticsSummary> {
    const [result] = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: { $ne: 'cancelled' },
        },
      },
      {
        $group: {
          _id: null,
          orderCount: { $sum: 1 },
          revenue: { $sum: '$total' },
          averageOrderValue: { $avg: '$total' },
        },
      },
    ]);

    return {
      orderCount: result?.orderCount || 0,
      revenue: result?.revenue ? Math.round(result.revenue * 100) / 100 : 0,
      averageOrderValue: result?.averageOrderValue
        ? Math.round(result.averageOrderValue * 100) / 100
        : 0,
    };
  },

  /**
   * Aggregate revenue trend over time by day, week, or month,
   * excluding cancelled orders. Continuous dates are populated for day granularity.
   */
  async getRevenueTrend(
    from: Date,
    to: Date,
    granularity: Granularity
  ): Promise<RevenueTrendPoint[]> {
    const formatString = getDateFormatString(granularity);

    const results = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: { $ne: 'cancelled' },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: formatString,
              date: '$createdAt',
              timezone: 'UTC',
            },
          },
          revenue: { $sum: '$total' },
          orderCount: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    if (granularity === 'day') {
      const trendMap = new Map<string, { date: string; revenue: number; orderCount: number }>();
      const curr = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
      const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));

      while (curr <= end) {
        const dStr = curr.toISOString().slice(0, 10);
        trendMap.set(dStr, { date: dStr, revenue: 0, orderCount: 0 });
        curr.setUTCDate(curr.getUTCDate() + 1);
      }

      for (const item of results) {
        trendMap.set(item._id, {
          date: item._id,
          revenue: Math.round(item.revenue * 100) / 100,
          orderCount: item.orderCount,
        });
      }

      return Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    }

    return results.map((item) => ({
      date: item._id,
      revenue: Math.round(item.revenue * 100) / 100,
      orderCount: item.orderCount,
    }));
  },

  /**
   * Top selling products by revenue within date range, excluding cancelled orders.
   */
  async getTopProducts(from: Date, to: Date, limit: number): Promise<TopProductMetric[]> {
    const results = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: { $ne: 'cancelled' },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            productId: '$items.product',
            name: '$items.name',
          },
          unitsSold: { $sum: '$items.quantity' },
          revenue: {
            $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] },
          },
        },
      },
      {
        $sort: { revenue: -1 },
      },
      {
        $limit: limit,
      },
      {
        $project: {
          _id: 0,
          productId: '$_id.productId',
          name: '$_id.name',
          unitsSold: 1,
          revenue: { $round: ['$revenue', 2] },
        },
      },
    ]);

    return results;
  },

  /**
   * Inventory alert list fetching low stock and out of stock variants.
   * Leverages inventoryService to preserve threshold logic.
   */
  async getInventoryAlerts() {
    const [lowStockResult, outOfStockResult] = await Promise.all([
      inventoryService.getAdminInventory({ status: 'low_stock', limit: 100 }),
      inventoryService.getAdminInventory({ status: 'out_of_stock', limit: 100 }),
    ]);

    return {
      lowStock: lowStockResult.items,
      outOfStock: outOfStockResult.items,
      lowStockCount: lowStockResult.total,
      outOfStockCount: outOfStockResult.total,
    };
  },

  /**
   * Customer growth over time grouped by granularity.
   */
  async getCustomerGrowth(
    from: Date,
    to: Date,
    granularity: Granularity
  ): Promise<CustomerGrowthPoint[]> {
    const formatString = getDateFormatString(granularity);

    const results = await User.aggregate([
      {
        $match: {
          role: 'customer',
          createdAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: formatString,
              date: '$createdAt',
              timezone: 'UTC',
            },
          },
          newCustomers: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    if (granularity === 'day') {
      const growthMap = new Map<string, { date: string; newCustomers: number }>();
      const curr = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
      const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));

      while (curr <= end) {
        const dStr = curr.toISOString().slice(0, 10);
        growthMap.set(dStr, { date: dStr, newCustomers: 0 });
        curr.setUTCDate(curr.getUTCDate() + 1);
      }

      for (const item of results) {
        growthMap.set(item._id, {
          date: item._id,
          newCustomers: item.newCustomers,
        });
      }

      return Array.from(growthMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    }

    return results.map((item) => ({
      date: item._id,
      newCustomers: item.newCustomers,
    }));
  },

  /**
   * Reward point and wallet summary aggregated directly from Wallet and PointsTransaction collections.
   */
  async getWalletSummary(): Promise<WalletSummaryMetrics> {
    const [walletTotals] = await Wallet.aggregate([
      {
        $group: {
          _id: null,
          totalOutstandingPoints: { $sum: '$balancePoints' },
          totalPointsIssued: { $sum: '$lifetimeEarnedPoints' },
          totalPointsRedeemed: { $sum: '$lifetimeSpentPoints' },
          activeWalletsCount: {
            $sum: { $cond: [{ $eq: ['$active', true] }, 1, 0] },
          },
          totalWalletsCount: { $sum: 1 },
        },
      },
    ]);

    const txTotals = await PointsTransaction.aggregate([
      {
        $group: {
          _id: { type: '$type', direction: '$direction' },
          totalPoints: { $sum: '$points' },
          count: { $sum: 1 },
        },
      },
    ]);

    let refundPointsIssued = 0;
    let orderPointsRedeemed = 0;
    let adminCreditPoints = 0;
    let adminDebitPoints = 0;
    let reversalPoints = 0;
    let txTotalPointsIssued = 0;

    for (const tx of txTotals) {
      if (tx._id.direction === 'credit') {
        txTotalPointsIssued += tx.totalPoints;
      }
      if (tx._id.type === 'refund_earn') {
        refundPointsIssued += tx.totalPoints;
      } else if (tx._id.type === 'order_spend') {
        orderPointsRedeemed += tx.totalPoints;
      } else if (tx._id.type === 'admin_credit') {
        adminCreditPoints += tx.totalPoints;
      } else if (tx._id.type === 'admin_debit') {
        adminDebitPoints += tx.totalPoints;
      } else if (tx._id.type === 'reversal') {
        reversalPoints += tx.totalPoints;
      }
    }

    const totalPointsIssued = walletTotals?.totalPointsIssued ?? txTotalPointsIssued;
    const totalPointsRedeemed = walletTotals?.totalPointsRedeemed ?? orderPointsRedeemed;

    return {
      totalOutstandingPoints: walletTotals?.totalOutstandingPoints ?? 0,
      totalPointsIssued,
      totalPointsRedeemed,
      refundPointsIssued,
      orderPointsRedeemed,
      adminCreditPoints,
      adminDebitPoints,
      reversalPoints,
      activeWalletsCount: walletTotals?.activeWalletsCount ?? 0,
      totalWalletsCount: walletTotals?.totalWalletsCount ?? 0,
    };
  },
};
