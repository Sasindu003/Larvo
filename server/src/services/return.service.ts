import mongoose, { Types } from 'mongoose';
import { AppError } from '../middleware/error.middleware';
import { Order } from '../models/Order';
import ReturnRequest, { IReturnRequest } from '../models/ReturnRequest';
import {
  CreateReturnRequestInput,
  DecisionInput,
  GetAdminReturnsQuery,
  GetDeliveryReturnsQuery,
} from '../validators/return.validator';
import { walletService } from './wallet.service';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export class ReturnService {
  /**
   * Submit a return request for a delivered order within the 7-day window.
   */
  async createReturnRequest(
    userId: string | Types.ObjectId,
    input: CreateReturnRequestInput
  ): Promise<IReturnRequest> {
    const order = await Order.findById(input.orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    if (order.user.toString() !== userId.toString()) {
      throw new AppError('You are not authorized to request a return for this order', 403);
    }

    if (order.status !== 'delivered') {
      throw new AppError('Only delivered orders are eligible for return', 400);
    }

    if (!order.deliveredAt) {
      throw new AppError('Order does not have a recorded delivery timestamp', 400);
    }

    const elapsed = Date.now() - new Date(order.deliveredAt).getTime();
    if (elapsed > SEVEN_DAYS_MS) {
      throw new AppError(
        'Return window has expired. Returns must be requested within 7 days of delivery.',
        400
      );
    }

    // Duplicate guard: allow resubmission only if previous returns for this order were rejected
    const activeReturn = await ReturnRequest.findOne({
      order: order._id,
      status: { $ne: 'rejected' },
    });
    if (activeReturn) {
      throw new AppError('A return request has already been submitted for this order', 400);
    }

    // Check item references and quantities
    const seenRefs = new Set<number>();
    const preparedItems = input.items.map((item) => {
      if (seenRefs.has(item.orderItemRef)) {
        throw new AppError(`Duplicate item reference in return request: ${item.orderItemRef}`, 400);
      }
      seenRefs.add(item.orderItemRef);

      const orderItem = order.items[item.orderItemRef];
      if (!orderItem) {
        throw new AppError(`Invalid order item reference: ${item.orderItemRef}`, 400);
      }

      if (item.qty > orderItem.quantity) {
        throw new AppError(
          `Return quantity (${item.qty}) exceeds purchased quantity (${orderItem.quantity}) for "${orderItem.name}"`,
          400
        );
      }

      return {
        orderItemRef: item.orderItemRef,
        sku: orderItem.variantSku || '',
        qty: item.qty,
        reason: item.reason,
      };
    });

    const returnRequest = await ReturnRequest.create({
      order: order._id,
      user: userId,
      items: preparedItems,
      status: 'requested',
      rejectionReason: null,
      refundPoints: null,
      refundMethod: null,
      refundedAt: null,
    });

    return returnRequest;
  }

  /**
   * List returns submitted by the current user with pagination.
   */
  async getMyReturnRequests(
    userId: string | Types.ObjectId,
    options: { page?: number; limit?: number; orderId?: string }
  ) {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? options.limit : 10;
    const skip = (page - 1) * limit;

    const query: any = { user: userId };
    if (options.orderId) {
      query.order = options.orderId;
    }

    const [results, total] = await Promise.all([
      ReturnRequest.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('order', 'total status deliveredAt createdAt items')
        .lean(),
      ReturnRequest.countDocuments(query),
    ]);

    return {
      results,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Get single return by ID. Only owner or privileged roles (staff, admin, owner) can view.
   */
  async getReturnById(
    returnId: string,
    requester: { userId: string | Types.ObjectId; role: string }
  ): Promise<IReturnRequest> {
    const returnRequest = await ReturnRequest.findById(returnId)
      .populate('order')
      .populate('user', 'name email role');

    if (!returnRequest) {
      throw new AppError('Return request not found', 404);
    }

    const isPrivileged = ['staff', 'admin', 'owner'].includes(requester.role);
    const ownerId =
      returnRequest.user && (returnRequest.user as any)._id
        ? (returnRequest.user as any)._id.toString()
        : returnRequest.user.toString();

    if (!isPrivileged && ownerId !== requester.userId.toString()) {
      throw new AppError('Access denied', 403);
    }

    return returnRequest;
  }

  /**
   * Get latest return for a given order ID.
   */
  async getReturnByOrderId(
    orderId: string,
    requester: { userId: string | Types.ObjectId; role: string }
  ): Promise<IReturnRequest | null> {
    const returnRequest = await ReturnRequest.findOne({ order: orderId })
      .sort({ createdAt: -1 })
      .populate('order')
      .populate('user', 'name email role');

    if (!returnRequest) {
      return null;
    }

    const isPrivileged = ['staff', 'admin', 'owner'].includes(requester.role);
    const ownerId =
      returnRequest.user && (returnRequest.user as any)._id
        ? (returnRequest.user as any)._id.toString()
        : returnRequest.user.toString();

    if (!isPrivileged && ownerId !== requester.userId.toString()) {
      throw new AppError('Access denied', 403);
    }

    return returnRequest;
  }

  /**
   * List all return requests for staff/admin/owner, with server-computed estimated refund points.
   */
  async getAdminReturns(options: GetAdminReturnsQuery) {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? options.limit : 10;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (options.status) {
      query.status = options.status;
    }
    if (options.userId) {
      query.user = options.userId;
    }

    const [returnDocs, total] = await Promise.all([
      ReturnRequest.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'name email role')
        .populate('order', 'total status deliveredAt createdAt items subtotal discountAmount')
        .lean(),
      ReturnRequest.countDocuments(query),
    ]);

    const results = returnDocs.map((doc: any) => {
      let estimatedRefundPoints: number | null = null;

      if (doc.status === 'refunded') {
        estimatedRefundPoints = doc.refundPoints ?? null;
      } else if (doc.status === 'rejected') {
        estimatedRefundPoints = null;
      } else if (doc.status === 'approved' && doc.estimatedRefundPoints != null) {
        estimatedRefundPoints = doc.estimatedRefundPoints;
      } else {
        const order = doc.order;
        if (order && Array.isArray(order.items)) {
          const returnItems = doc.items.map((item: any) => {
            const orderItem =
              order.items[item.orderItemRef] ||
              order.items.find((oi: any) => oi.variantSku === item.sku);
            return {
              unitPrice: orderItem ? orderItem.unitPrice : 0,
              quantity: item.qty,
            };
          });
          estimatedRefundPoints = walletService.calculateRefundPoints(
            {
              subtotal: order.subtotal || 0,
              discountAmount: order.discountAmount || 0,
            },
            returnItems
          );
        }
      }

      return {
        ...doc,
        estimatedRefundPoints,
      };
    });

    return {
      results,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Approve or reject a return request.
   * Rejection strictly requires a reason (minimum 5 characters).
   * Approval computes and persists estimatedRefundPoints.
   */
  async processReturnDecision(
    returnId: string,
    input: DecisionInput
  ): Promise<IReturnRequest> {
    const returnRequest = await ReturnRequest.findById(returnId).populate('order');
    if (!returnRequest) {
      throw new AppError('Return request not found', 404);
    }

    if (input.decision === 'rejected') {
      const reason = input.rejectionReason?.trim();
      if (!reason || reason.length === 0) {
        throw new AppError('A valid rejection reason is required when rejecting a return request', 400);
      }
      if (reason.length < 5) {
        throw new AppError('Rejection reason must be at least 5 characters', 400);
      }
      returnRequest.status = 'rejected';
      returnRequest.rejectionReason = reason;
      returnRequest.estimatedRefundPoints = null;
    } else if (input.decision === 'approved') {
      let order = returnRequest.order as any;
      if (!order || !Array.isArray(order.items)) {
        order = await Order.findById(returnRequest.order);
      }
      if (!order) {
        throw new AppError('Associated order not found', 404);
      }

      const returnItems = returnRequest.items.map((item) => {
        const orderItem =
          order.items[item.orderItemRef] ||
          order.items.find((oi: any) => oi.variantSku === item.sku);
        return {
          unitPrice: orderItem ? orderItem.unitPrice : 0,
          quantity: item.qty,
        };
      });

      const estimatedPoints = walletService.calculateRefundPoints(
        {
          subtotal: order.subtotal || 0,
          discountAmount: order.discountAmount || 0,
        },
        returnItems
      );

      returnRequest.status = 'pickup_scheduled';
      returnRequest.rejectionReason = null;
      returnRequest.estimatedRefundPoints = estimatedPoints;
    }

    await returnRequest.save();
    return returnRequest;
  }

  /**
   * Get return requests for delivery manager pickup queue.
   * Restricts by default to active pickups: pickup_scheduled, picked_up.
   */
  async getDeliveryReturns(
    query: GetDeliveryReturnsQuery
  ): Promise<{ results: any[]; total: number; page: number; pages: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(50, query.limit || 10));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.status) {
      filter.status = query.status;
    } else {
      filter.status = { $in: ['pickup_scheduled', 'picked_up'] };
    }

    const [returnDocs, total] = await Promise.all([
      ReturnRequest.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'name email phone')
        .populate('order', 'orderNumber shippingAddress contactPhone items totalAmount createdAt')
        .lean(),
      ReturnRequest.countDocuments(filter),
    ]);

    return {
      results: returnDocs,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Advance return pickup status through delivery lifecycle.
   * Allowed transitions:
   *   pickup_scheduled -> picked_up
   *   picked_up -> received
   */
  async advanceReturnPickupStatus(
    returnId: string,
    newStatus: 'picked_up' | 'received'
  ): Promise<IReturnRequest> {
    const returnRequest = await ReturnRequest.findById(returnId)
      .populate('user', 'name email phone')
      .populate('order', 'orderNumber shippingAddress contactPhone items totalAmount createdAt');

    if (!returnRequest) {
      throw new AppError('Return request not found', 404);
    }

    if (returnRequest.status === 'pickup_scheduled' && newStatus === 'picked_up') {
      returnRequest.status = 'picked_up';
    } else if (returnRequest.status === 'picked_up' && newStatus === 'received') {
      returnRequest.status = 'received';
    } else {
      throw new AppError(
        `Invalid status transition from '${returnRequest.status}' to '${newStatus}'`,
        400
      );
    }

    await returnRequest.save();
    return returnRequest;
  }

  /**
   * Process refund to customer wallet in points for a received return request.
   * Strictly requires admin or owner role (enforced in router).
   * Strictly requires returnRequest.status === 'received'.
   * Uses MongoDB transaction session and idempotency key 'return_refund:<returnRequestId>'.
   */
  async processRefund(
    returnId: string,
    actorId: string | Types.ObjectId
  ): Promise<IReturnRequest> {
    const existing = await ReturnRequest.findById(returnId);
    if (!existing) {
      throw new AppError('Return request not found', 404);
    }

    // Idempotent guard: if already refunded, return as-is
    if (existing.status === 'refunded') {
      const populated = await ReturnRequest.findById(returnId)
        .populate('user', 'name email')
        .populate('order');
      return populated!;
    }

    if (existing.status !== 'received') {
      throw new AppError(
        `Return request must be in 'received' status before refund can be processed. Current status is '${existing.status}'`,
        400
      );
    }

    // Fetch order to compute or confirm refund points
    let order: any = await Order.findById(existing.order);
    if (!order) {
      throw new AppError('Associated order not found', 404);
    }

    const returnItems = existing.items.map((item) => {
      const orderItem =
        order.items[item.orderItemRef] ||
        order.items.find((oi: any) => oi.variantSku === item.sku);
      return {
        unitPrice: orderItem ? orderItem.unitPrice : 0,
        quantity: item.qty,
      };
    });

    const refundPoints =
      existing.estimatedRefundPoints != null && existing.estimatedRefundPoints > 0
        ? existing.estimatedRefundPoints
        : walletService.calculateRefundPoints(
            {
              subtotal: order.subtotal || 0,
              discountAmount: order.discountAmount || 0,
            },
            returnItems
          );

    const idempotencyKey = `return_refund:${existing._id.toString()}`;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const returnDoc = await ReturnRequest.findById(returnId).session(session);
      if (!returnDoc) {
        throw new AppError('Return request not found', 404);
      }

      if (returnDoc.status === 'refunded') {
        await session.commitTransaction();
        const populated = await ReturnRequest.findById(returnId)
          .populate('user', 'name email')
          .populate('order');
        return populated!;
      }

      if (returnDoc.status !== 'received') {
        throw new AppError(
          `Return request must be in 'received' status before refund can be processed. Current status is '${returnDoc.status}'`,
          400
        );
      }

      // Credit wallet points with session & idempotencyKey
      await walletService.credit({
        userId: returnDoc.user,
        points: refundPoints,
        type: 'refund_earn',
        orderId: returnDoc.order,
        returnRequestId: returnDoc._id,
        idempotencyKey,
        note: `Points refund for return #${returnDoc._id.toString().slice(-6).toUpperCase()}`,
        adminUserId: actorId,
        session,
      });

      returnDoc.status = 'refunded';
      returnDoc.refundPoints = refundPoints;
      returnDoc.refundMethod = 'wallet_points';
      returnDoc.refundedAt = new Date();

      await returnDoc.save({ session });
      await session.commitTransaction();

      const populated = await ReturnRequest.findById(returnId)
        .populate('user', 'name email')
        .populate('order');
      return populated!;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }
}

export const returnService = new ReturnService();
export default returnService;
