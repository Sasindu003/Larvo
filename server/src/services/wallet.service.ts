import { ClientSession, Types } from 'mongoose';
import { Wallet, IWallet } from '../models/Wallet';
import {
  PointsTransaction,
  IPointsTransaction,
  PointsTransactionType,
} from '../models/PointsTransaction';
import { User } from '../models/User';
import { Setting } from '../models/Setting';
import { Request } from 'express';
import { AppError } from '../utils/AppError';
import { audit } from './audit.service';
import {
  POINT_VALUE,
  REFUND_POINTS_PER_CURRENCY_UNIT,
} from '../constants/rewardPoints';

export interface ConversionRateResult {
  pointsPerRupee: number;
  pointValue: number;
}

export interface CreditPointsParams {
  userId: string | Types.ObjectId;
  points: number;
  type: PointsTransactionType;
  orderId?: string | Types.ObjectId | null;
  returnRequestId?: string | Types.ObjectId | null;
  idempotencyKey: string;
  note?: string | null;
  adminUserId?: string | Types.ObjectId | null;
  session?: ClientSession;
  req?: Request;
}

export interface DebitPointsParams {
  userId: string | Types.ObjectId;
  points: number;
  type: PointsTransactionType;
  orderId?: string | Types.ObjectId | null;
  idempotencyKey: string;
  note?: string | null;
  adminUserId?: string | Types.ObjectId | null;
  session?: ClientSession;
  req?: Request;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  q?: string;
}

export interface PaginatedResult<T> {
  results: T[];
  total: number;
  page: number;
  pages: number;
}

function onSessionCommit(session: ClientSession | undefined, fn: () => void) {
  if (!session || !session.inTransaction()) {
    fn();
    return;
  }
  const sess = session as any;
  if (!sess._onCommitHooks) {
    sess._onCommitHooks = [];
    const origCommit = sess.commitTransaction.bind(sess);
    sess.commitTransaction = async function (...args: any[]) {
      await origCommit(...args);
      for (const hook of sess._onCommitHooks) {
        try {
          hook();
        } catch {
          // ignore
        }
      }
      sess._onCommitHooks = [];
    };
  }
  sess._onCommitHooks.push(fn);
}

export class WalletService {
  /**
   * Atomic upsert ensuring exactly one wallet exists per user.
   */
  async getOrCreateWallet(
    userId: string | Types.ObjectId,
    session?: ClientSession
  ): Promise<IWallet> {
    const uid = new Types.ObjectId(userId.toString());
    const existing = await Wallet.findOne({ user: uid }).session(session || null);
    if (existing) {
      return existing;
    }

    const wallet = await Wallet.findOneAndUpdate(
      { user: uid },
      {
        $setOnInsert: {
          user: uid,
          balancePoints: 0,
          lifetimeEarnedPoints: 0,
          lifetimeSpentPoints: 0,
          active: true,
        },
      },
      { new: true, upsert: true, session }
    );

    return wallet!;
  }

  /**
   * Credit points to a wallet and write an immutable ledger record.
   * Idempotency: Returns existing transaction if idempotencyKey already recorded.
   */
  async credit(
    params: CreditPointsParams
  ): Promise<{ wallet: IWallet; transaction: IPointsTransaction }> {
    // 1. Idempotency check
    const existingTx = await PointsTransaction.findOne({
      idempotencyKey: params.idempotencyKey,
    }).session(params.session || null);

    if (existingTx) {
      const wallet = await Wallet.findOne({ user: params.userId }).session(
        params.session || null
      );
      return { wallet: wallet!, transaction: existingTx };
    }

    if (!Number.isInteger(params.points) || params.points <= 0) {
      throw new AppError('Points must be a positive integer', 400);
    }

    // Ensure wallet exists
    await this.getOrCreateWallet(params.userId, params.session);

    // Atomically increment balance
    const updatedWallet = await Wallet.findOneAndUpdate(
      { user: params.userId, active: true },
      {
        $inc: {
          balancePoints: params.points,
          lifetimeEarnedPoints: params.points,
        },
      },
      { new: true, session: params.session }
    );

    if (!updatedWallet) {
      throw new AppError('Wallet not found or is deactivated', 400);
    }

    // Record ledger row
    const [tx] = await PointsTransaction.create(
      [
        {
          wallet: updatedWallet._id,
          user: params.userId,
          type: params.type,
          direction: 'credit',
          points: params.points,
          balanceAfter: updatedWallet.balancePoints,
          ...(params.orderId ? { order: params.orderId } : {}),
          ...(params.returnRequestId ? { returnRequest: params.returnRequestId } : {}),
          idempotencyKey: params.idempotencyKey,
          ...(params.note ? { note: params.note } : {}),
          ...(params.adminUserId ? { createdBy: params.adminUserId } : {}),
        },
      ],
      params.session ? { session: params.session } : {}
    );

    onSessionCommit(params.session, () => {
      audit(
        params.req,
        'WALLET_CREDIT',
        'Wallet',
        updatedWallet._id,
        {
          amount: params.points,
          reason: params.note || params.type,
          balanceAfter: updatedWallet.balancePoints,
        },
        { _id: params.adminUserId || params.userId, role: params.adminUserId ? 'admin' : 'customer' }
      );

      if (params.type === 'refund_earn') {
        audit(
          params.req,
          'REFUND_ISSUED',
          'Order',
          params.orderId,
          {
            orderId: params.orderId ? String(params.orderId) : '',
            amount: params.points,
          },
          { _id: params.adminUserId || params.userId, role: params.adminUserId ? 'admin' : 'customer' }
        );
      }
    });

    return { wallet: updatedWallet, transaction: tx };
  }

  /**
   * Debit points from a wallet with atomic floor guard preventing negative balance.
   * Idempotency: Returns existing transaction if idempotencyKey already recorded.
   */
  async debit(
    params: DebitPointsParams
  ): Promise<{ wallet: IWallet; transaction: IPointsTransaction }> {
    // 1. Idempotency check
    const existingTx = await PointsTransaction.findOne({
      idempotencyKey: params.idempotencyKey,
    }).session(params.session || null);

    if (existingTx) {
      const wallet = await Wallet.findOne({ user: params.userId }).session(
        params.session || null
      );
      return { wallet: wallet!, transaction: existingTx };
    }

    if (!Number.isInteger(params.points) || params.points <= 0) {
      throw new AppError('Points must be a positive integer', 400);
    }

    // Ensure wallet exists
    await this.getOrCreateWallet(params.userId, params.session);

    // Atomically decrement balance with floor guard
    const updatedWallet = await Wallet.findOneAndUpdate(
      {
        user: params.userId,
        active: true,
        balancePoints: { $gte: params.points },
      },
      {
        $inc: {
          balancePoints: -params.points,
          lifetimeSpentPoints: params.points,
        },
      },
      { new: true, session: params.session }
    );

    if (!updatedWallet) {
      const current = await Wallet.findOne({ user: params.userId }).session(
        params.session || null
      );
      if (!current?.active) {
        throw new AppError('Wallet not found or is deactivated', 400);
      }
      throw new AppError('Insufficient reward points balance', 400);
    }

    // Record ledger row
    const [tx] = await PointsTransaction.create(
      [
        {
          wallet: updatedWallet._id,
          user: params.userId,
          type: params.type,
          direction: 'debit',
          points: params.points,
          balanceAfter: updatedWallet.balancePoints,
          ...(params.orderId ? { order: params.orderId } : {}),
          idempotencyKey: params.idempotencyKey,
          ...(params.note ? { note: params.note } : {}),
          ...(params.adminUserId ? { createdBy: params.adminUserId } : {}),
        },
      ],
      params.session ? { session: params.session } : {}
    );

    onSessionCommit(params.session, () => {
      audit(
        params.req,
        'WALLET_DEBIT',
        'Wallet',
        updatedWallet._id,
        {
          amount: params.points,
          reason: params.note || params.type,
          balanceAfter: updatedWallet.balancePoints,
        },
        { _id: params.adminUserId || params.userId, role: params.adminUserId ? 'admin' : 'customer' }
      );
    });

    return { wallet: updatedWallet, transaction: tx };
  }

  private cachedPointsPerRupee: number | null = null;
  private lastCacheTime: number = 0;
  private readonly CACHE_TTL_MS: number = 60 * 1000;

  /**
   * Fetch current points per Rs. 1 from MongoDB setting (cached), defaulting to 100.
   */
  async getPointsPerRupee(): Promise<number> {
    const now = Date.now();
    if (this.cachedPointsPerRupee !== null && now - this.lastCacheTime < this.CACHE_TTL_MS) {
      return this.cachedPointsPerRupee;
    }

    try {
      const doc = await Setting.findOne({ key: 'points_per_rupee' });
      if (doc && typeof doc.value === 'number' && doc.value > 0) {
        this.cachedPointsPerRupee = doc.value;
        this.lastCacheTime = now;
        return doc.value;
      }
    } catch (err) {
      console.error('Failed to load points_per_rupee setting from DB:', err);
    }

    this.cachedPointsPerRupee = REFUND_POINTS_PER_CURRENCY_UNIT;
    this.lastCacheTime = now;
    return REFUND_POINTS_PER_CURRENCY_UNIT;
  }

  /**
   * Get formatted conversion rate object { pointsPerRupee, pointValue }.
   */
  async getConversionRate(): Promise<ConversionRateResult> {
    const pointsPerRupee = await this.getPointsPerRupee();
    return {
      pointsPerRupee,
      pointValue: Number((1 / pointsPerRupee).toFixed(6)),
    };
  }

  /**
   * Update points conversion value per Rs. 1 in MongoDB setting.
   */
  async updateConversionRate(
    pointsPerRupee: number,
    adminUserId?: string | Types.ObjectId
  ): Promise<ConversionRateResult> {
    if (typeof pointsPerRupee !== 'number' || isNaN(pointsPerRupee) || pointsPerRupee <= 0) {
      throw new AppError('Points per Rupee must be a positive number greater than 0', 400);
    }

    await Setting.findOneAndUpdate(
      { key: 'points_per_rupee' },
      {
        $set: {
          value: pointsPerRupee,
          description: 'Number of reward points equivalent to Rs. 1.00',
          ...(adminUserId ? { updatedBy: new Types.ObjectId(adminUserId.toString()) } : {}),
        },
      },
      { upsert: true, new: true }
    );

    this.cachedPointsPerRupee = pointsPerRupee;
    this.lastCacheTime = Date.now();

    return {
      pointsPerRupee,
      pointValue: Number((1 / pointsPerRupee).toFixed(6)),
    };
  }

  /**
   * Calculate refundable points considering order discounts proportionally.
   * Can accept dynamic pointsPerRupee or uses cached/default rate.
   */
  calculateRefundPoints(
    order: { subtotal: number; discountAmount?: number },
    returnItems: Array<{ unitPrice: number; quantity: number }>,
    pointsPerRupee?: number
  ): number {
    const rate = pointsPerRupee ?? this.cachedPointsPerRupee ?? REFUND_POINTS_PER_CURRENCY_UNIT;
    const returnedGross = returnItems.reduce(
      (acc, item) => acc + item.unitPrice * item.quantity,
      0
    );
    const proportionalDiscount =
      order.subtotal > 0
        ? (returnedGross * (order.discountAmount || 0)) / order.subtotal
        : 0;
    const refundAmount = Math.max(
      0,
      Math.floor(returnedGross - proportionalDiscount)
    );
    return Math.round(refundAmount * rate);
  }

  /**
   * Convert currency amount to required points.
   * Can accept dynamic pointsPerRupee or uses cached/default rate.
   */
  currencyToPoints(amount: number, pointsPerRupee?: number): number {
    const rate = pointsPerRupee ?? this.cachedPointsPerRupee ?? REFUND_POINTS_PER_CURRENCY_UNIT;
    return Math.ceil(amount * rate);
  }

  /**
   * Convert points to currency value (Rs.).
   */
  pointsToCurrency(points: number, pointsPerRupee?: number): number {
    const rate = pointsPerRupee ?? this.cachedPointsPerRupee ?? REFUND_POINTS_PER_CURRENCY_UNIT;
    return Number((points / rate).toFixed(2));
  }

  /**
   * Check if customer can pay given order total using their points balance.
   */
  async canPayOrderWithPoints(
    userId: string | Types.ObjectId,
    orderTotal: number
  ): Promise<boolean> {
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet || !wallet.active) return false;
    const rate = await this.getPointsPerRupee();
    const requiredPoints = this.currencyToPoints(orderTotal, rate);
    return wallet.balancePoints >= requiredPoints;
  }


  /**
   * Get user's wallet document.
   */
  async getUserWallet(userId: string | Types.ObjectId): Promise<IWallet> {
    return this.getOrCreateWallet(userId);
  }

  /**
   * Get paginated transactions for a user.
   */
  async getUserTransactions(
    userId: string | Types.ObjectId,
    query: PaginationQuery
  ): Promise<PaginatedResult<IPointsTransaction>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [results, total] = await Promise.all([
      PointsTransaction.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PointsTransaction.countDocuments({ user: userId }),
    ]);

    return {
      results,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Get paginated admin wallets list with user info and optional search.
   */
  async getAdminWallets(
    query: PaginationQuery
  ): Promise<PaginatedResult<IWallet>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (query.q && query.q.trim()) {
      const matchedUsers = await User.find({
        $or: [
          { name: { $regex: query.q.trim(), $options: 'i' } },
          { email: { $regex: query.q.trim(), $options: 'i' } },
        ],
      }).select('_id');
      await Promise.all(matchedUsers.map((u) => this.getOrCreateWallet(u._id)));
      filter.user = { $in: matchedUsers.map((u) => u._id) };
    }

    const [results, total] = await Promise.all([
      Wallet.find(filter)
        .populate('user', 'name email role')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      Wallet.countDocuments(filter),
    ]);

    return {
      results,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Admin: Get a specific user's wallet with user info.
   */
  async getAdminWalletByUser(userId: string | Types.ObjectId): Promise<IWallet> {
    const wallet = await this.getOrCreateWallet(userId);
    await wallet.populate('user', 'name email role');
    return wallet;
  }

  /**
   * Admin adjust points (credit or debit).
   */
  async adminAdjustWallet(
    params: {
      userId: string | Types.ObjectId;
      adminUserId: string | Types.ObjectId;
      direction: 'credit' | 'debit';
      points: number;
      reason: string;
    },
    req?: Request
  ): Promise<{ wallet: IWallet; transaction: IPointsTransaction }> {
    const idempotencyKey = `admin-adjust-${params.userId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    if (params.direction === 'credit') {
      return this.credit({
        userId: params.userId,
        points: params.points,
        type: 'admin_credit',
        idempotencyKey,
        note: params.reason,
        adminUserId: params.adminUserId,
        req,
      });
    } else {
      return this.debit({
        userId: params.userId,
        points: params.points,
        type: 'admin_debit',
        idempotencyKey,
        note: params.reason,
        adminUserId: params.adminUserId,
        req,
      });
    }
  }
}

export const walletService = new WalletService();
export default walletService;
