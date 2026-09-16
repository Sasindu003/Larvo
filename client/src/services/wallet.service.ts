import api, { ApiResponse } from './api';

export const POINT_VALUE = 0.01;

export interface Wallet {
  _id: string;
  user: string;
  balancePoints: number;
  lifetimeEarnedPoints: number;
  lifetimeSpentPoints: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminWalletUser {
  _id: string;
  name: string;
  email: string;
  role: string;
}

export interface AdminWallet {
  _id: string;
  user: AdminWalletUser;
  balancePoints: number;
  lifetimeEarnedPoints: number;
  lifetimeSpentPoints: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PointsTransactionType =
  | 'refund_earn'
  | 'order_spend'
  | 'admin_credit'
  | 'admin_debit'
  | 'reversal';

export type PointsTransactionDirection = 'credit' | 'debit';

export interface PointsTransaction {
  _id: string;
  wallet: string;
  user: string;
  type: PointsTransactionType;
  direction: PointsTransactionDirection;
  points: number;
  balanceAfter: number;
  order?: string | { _id: string; trackingNumber?: string } | null;
  returnRequest?: string | null;
  idempotencyKey: string;
  note?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedTransactions {
  results: PointsTransaction[];
  total: number;
  page: number;
  pages: number;
}

export interface PaginatedAdminWallets {
  results: AdminWallet[];
  total: number;
  page: number;
  pages: number;
}

function extractError(error: any): never {
  if (error?.message) {
    throw new Error(error.message);
  }
  if (error?.response?.data?.message) {
    throw new Error(error.response.data.message);
  }
  throw error;
}

export const walletService = {
  /**
   * Get current authenticated user's wallet
   */
  async getMyWallet(): Promise<Wallet> {
    try {
      const res = await api.get<ApiResponse<Wallet>>('/wallet/me');
      return (res as any).data || (res as any);
    } catch (err) {
      return extractError(err);
    }
  },

  /**
   * Get current authenticated user's paginated points transactions
   */
  async getMyTransactions(page = 1, limit = 10): Promise<PaginatedTransactions> {
    try {
      const res = await api.get<ApiResponse<PaginatedTransactions>>('/wallet/me/transactions', {
        params: { page, limit },
      });
      return (res as any).data || (res as any);
    } catch (err) {
      return extractError(err);
    }
  },

  /**
   * Admin: Get paginated customer wallets with user info and optional search
   */
  async getAdminWallets(params?: {
    page?: number;
    limit?: number;
    q?: string;
  }): Promise<PaginatedAdminWallets> {
    try {
      const res = await api.get<ApiResponse<PaginatedAdminWallets>>('/admin/wallets', {
        params,
      });
      return (res as any).data || (res as any);
    } catch (err) {
      return extractError(err);
    }
  },

  /**
   * Admin: Get a specific customer's wallet
   */
  async getAdminWalletByUser(userId: string): Promise<AdminWallet> {
    try {
      const res = await api.get<ApiResponse<AdminWallet>>(`/admin/wallets/${userId}`);
      return (res as any).data || (res as any);
    } catch (err) {
      return extractError(err);
    }
  },

  /**
   * Admin: Get a specific customer's paginated transactions
   */
  async getAdminWalletTransactions(
    userId: string,
    page = 1,
    limit = 10
  ): Promise<PaginatedTransactions> {
    try {
      const res = await api.get<ApiResponse<PaginatedTransactions>>(
        `/admin/wallets/${userId}/transactions`,
        {
          params: { page, limit },
        }
      );
      return (res as any).data || (res as any);
    } catch (err) {
      return extractError(err);
    }
  },

  /**
   * Admin: Adjust customer points (credit or debit)
   */
  async adminAdjustWallet(
    userId: string,
    data: {
      direction: 'credit' | 'debit';
      points: number;
      reason: string;
    }
  ): Promise<{ wallet: AdminWallet; transaction: PointsTransaction }> {
    try {
      const res = await api.post<
        ApiResponse<{ wallet: AdminWallet; transaction: PointsTransaction }>
      >(`/admin/wallets/${userId}/adjust`, data);
      return (res as any).data || (res as any);
    } catch (err) {
      return extractError(err);
    }
  },

  /**
   * Convert points to currency value (Rs.)
   */
  pointsToCurrency(points: number): number {
    return Number((points * POINT_VALUE).toFixed(2));
  },
};

export default walletService;
