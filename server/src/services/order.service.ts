import mongoose, { Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { Order, IOrder, IOrderItem, IAddressSnapshot, OrderStatus } from '../models/Order';
import { Payment, IPayment } from '../models/Payment';
import { Product } from '../models/Product';
import User, { IUser } from '../models/User';
import { inventoryService } from './inventory.service';
import { couponService } from './coupon.service';
import { walletService } from './wallet.service';
import { AppError } from '../middleware/error.middleware';
import { CreateOrderInput } from '../validators/order.validator';
import { SimulatePaymentInput } from '../validators/simulate-payment.validator';
import { assertTransition } from '../config/order-transitions';
import { invoiceService } from './invoice.service';

export const FREE_SHIPPING_THRESHOLD = 1500;
export const FLAT_SHIPPING_FEE = 60;

export interface CreateOrderResult {
  order: IOrder;
  couponWarning?: string | null;
}

export interface WalletPaymentResult {
  order: IOrder;
  payment: IPayment;
  pointsDeducted: number;
}

export interface SimulatePaymentResult {
  order: IOrder;
  payment: IPayment;
  approved: boolean;
}

export const orderService = {
  /**
   * Create a new order atomically within a MongoDB transaction.
   * Decrements inventory, resolves prices/subtotal/shipping server-side,
   * re-validates coupon (soft fallback on expiry), and sets status to 'pending_payment'.
   */
  async createOrder(
    userId: string | Types.ObjectId,
    input: CreateOrderInput
  ): Promise<CreateOrderResult> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    // 1. Fetch user to verify and snapshot shipping address
    const user = await User.findById(userObjId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const targetAddressId = input.shippingAddressId.trim();
    const address = user.addresses.find(
      (a) => a._id?.toString() === targetAddressId || (a as any).id === targetAddressId
    );

    if (!address) {
      throw new AppError('Shipping address not found', 400);
    }

    const shippingAddressSnapshot: IAddressSnapshot = {
      label: address.label,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      province: address.province,
      postalCode: address.postalCode,
      country: address.country,
    };

    // 2. Consolidate duplicate items if sent by client
    const itemMap = new Map<string, { productId: string; variantSku: string; quantity: number }>();
    for (const item of input.items) {
      const key = `${item.productId}_${item.variantSku}`;
      const existing = itemMap.get(key);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        itemMap.set(key, { ...item });
      }
    }
    const consolidatedItems = Array.from(itemMap.values());

    // 3. Start MongoDB Transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const orderItems: IOrderItem[] = [];

      for (const item of consolidatedItems) {
        // Fetch product within session
        const product = await Product.findById(item.productId).session(session);
        if (!product || product.status !== 'active') {
          throw new AppError(
            `Product '${product ? product.name : item.productId}' is not available`,
            400
          );
        }

        const variant = product.variants.find((v) => v.sku === item.variantSku);
        if (!variant) {
          throw new AppError(
            `Variant with SKU '${item.variantSku}' not found for product '${product.name}'`,
            400
          );
        }

        // Atomically decrement inventory with floor guard within session
        // Throws AppError(409) if stock < required quantity
        await inventoryService.adjustStock(
          product._id,
          variant.sku,
          -item.quantity,
          { session }
        );

        // Server-resolved unit price
        const unitPrice =
          product.discountPrice != null && product.discountPrice > 0
            ? product.discountPrice
            : product.basePrice;

        orderItems.push({
          product: product._id,
          name: product.name,
          image: product.images?.[0] || '',
          variantSku: variant.sku,
          size: variant.size,
          color: variant.color,
          unitPrice,
          quantity: item.quantity,
          lineTotal: unitPrice * item.quantity,
        });
      }

      // 4. Server-computed Subtotal
      const subtotal = orderItems.reduce(
        (sum, it) => sum + it.unitPrice * it.quantity,
        0
      );

      // 5. Coupon validation & discount computation
      let discountAmount = 0;
      let appliedCouponCode: string | null = null;
      let couponWarning: string | null = null;

      if (input.couponCode && input.couponCode.trim()) {
        const code = input.couponCode.trim().toUpperCase();
        try {
          const validation = await couponService.validateCoupon(
            code,
            userObjId.toString(),
            subtotal
          );

          if (validation.valid && validation.coupon && validation.discountAmount != null) {
            discountAmount = validation.discountAmount;
            appliedCouponCode = validation.coupon.code;
          } else {
            couponWarning =
              validation.message || 'Coupon is no longer valid; order placed without discount';
          }
        } catch (err: any) {
          couponWarning =
            err?.message || 'Coupon validation failed; order placed without discount';
        }
      }

      // Clamp discount
      discountAmount = Math.min(discountAmount, subtotal);

      // 6. Shipping & Total Calculation
      const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_FEE;
      const total = Math.max(0, subtotal - discountAmount + shippingFee);

      // 7. Atomically create Order document in 'pending_payment'
      const [order] = await Order.create(
        [
          {
            user: userObjId,
            items: orderItems,
            shippingAddress: shippingAddressSnapshot,
            couponCode: appliedCouponCode,
            discountAmount,
            subtotal,
            shippingFee,
            total,
            status: 'pending_payment',
            pointsPaid: 0,
          },
        ],
        { session }
      );

      await session.commitTransaction();

      return {
        order,
        couponWarning,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  },

  /**
   * Pay the full order total using wallet reward points.
   * Atomically debits wallet balance, upserts an approved 'reward_points' Payment,
   * transitions order status to 'confirmed', and sets order.pointsPaid within a single transaction.
   * Idempotent: repeated calls return existing payment without double-debiting.
   */
  async payWithWallet(
    userId: string | Types.ObjectId,
    orderId: string | Types.ObjectId
  ): Promise<WalletPaymentResult> {
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new AppError('Invalid order ID', 400);
    }

    const orderObjId = typeof orderId === 'string' ? new Types.ObjectId(orderId) : orderId;
    const userObjIdStr = userId.toString();

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Fetch order within session
      const order = await Order.findById(orderObjId).session(session);
      if (!order) {
        throw new AppError('Order not found', 404);
      }

      // 2. Ownership check
      if (order.user.toString() !== userObjIdStr) {
        throw new AppError('You do not have access to this order', 403);
      }

      // 3. Idempotency check: if payment already approved for reward_points, return existing
      const existingPayment = await Payment.findOne({ order: order._id }).session(session);
      if (
        existingPayment &&
        existingPayment.method === 'reward_points' &&
        existingPayment.status === 'approved'
      ) {
        await session.abortTransaction();
        return {
          order,
          payment: existingPayment,
          pointsDeducted: existingPayment.pointsUsed ?? walletService.currencyToPoints(order.total),
        };
      }

      // 4. Status check: order must be in 'pending_payment'
      if (order.status !== 'pending_payment') {
        throw new AppError(`Order cannot be paid with points in '${order.status}' status`, 400);
      }

      // 5. Total check: order total must be > 0
      if (order.total <= 0) {
        throw new AppError('Order total must be greater than zero for points payment', 400);
      }

      // 6. Server computes required points (never trusted from client)
      const pointsRequired = walletService.currencyToPoints(order.total);

      // 7. Atomically debit wallet points with floor guard and idempotency
      const { transaction } = await walletService.debit({
        userId: order.user,
        points: pointsRequired,
        type: 'order_spend',
        orderId: order._id,
        idempotencyKey: `order_spend:${order._id}`,
        note: `Full reward points payment for order #${order._id}`,
        session,
      });

      // 8. Upsert Payment document (handles new payment or prior rejected payment)
      const payment = await Payment.findOneAndUpdate(
        { order: order._id },
        {
          $set: {
            order: order._id,
            method: 'reward_points',
            amount: order.total,
            status: 'approved',
            pointsUsed: pointsRequired,
            walletTransaction: transaction._id,
            reviewedBy: null,
            reviewedAt: null,
            slipImageUrl: null,
            transactionId: null,
            maskedCardLast4: null,
            gatewayResponseCode: null,
          },
        },
        { new: true, upsert: true, session, runValidators: true }
      );

      // 9. Update Order status to 'confirmed' and record pointsPaid
      assertTransition(order.status, 'confirmed', 'customer', true);
      order.pointsPaid = pointsRequired;
      order.status = 'confirmed';
      await order.save({ session });

      // Generate invoice
      await invoiceService.generateInvoice(order, payment!, session);

      await session.commitTransaction();

      return {
        order,
        payment: payment!,
        pointsDeducted: pointsRequired,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  },

  /**
   * Submit manual payment slip for an order.
   * Enforces ownership, pending_payment status gate, and conflict guard against existing submitted/approved payments.
   * Overwrites rejected payments idempotently preserving document _id.
   */
  async submitPaymentSlip(
    userId: string | Types.ObjectId,
    orderId: string,
    slipUrlOrFilename: string
  ): Promise<{ order: IOrder; payment: IPayment }> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new AppError('Invalid order ID', 400);
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    if (order.user.toString() !== userObjId.toString()) {
      throw new AppError('You do not have access to this order', 403);
    }

    if (order.status !== 'pending_payment') {
      throw new AppError(`Cannot submit payment slip for order in '${order.status}' status`, 409);
    }

    const existingPayment = await Payment.findOne({ order: order._id });
    if (existingPayment) {
      if (existingPayment.status === 'submitted') {
        throw new AppError('Payment slip already submitted and under review', 409);
      }
      if (existingPayment.status === 'approved') {
        throw new AppError('Order is already paid; cannot submit a slip', 409);
      }
    }

    const slipImageUrl = slipUrlOrFilename.startsWith('/')
      ? slipUrlOrFilename
      : `/api/files/${slipUrlOrFilename}`;

    const payment = await Payment.findOneAndUpdate(
      { order: order._id },
      {
        $set: {
          order: order._id,
          method: 'bank_transfer',
          status: 'submitted',
          slipImageUrl,
          amount: order.total,
          pointsUsed: null,
          walletTransaction: null,
          reviewedBy: null,
          reviewedAt: null,
          reviewNote: null,
          transactionId: null,
          maskedCardLast4: null,
          gatewayResponseCode: null,
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    assertTransition(order.status, 'payment_review', 'customer', true);
    const updatedOrder = await Order.findByIdAndUpdate(
      order._id,
      { status: 'payment_review' },
      { new: true }
    );

    return {
      order: updatedOrder!,
      payment: payment!,
    };
  },

  /**
   * Simulate online card payment for an order.
   * Validates ownership, enforces idempotency / conflict checks,
   * evaluates card rules (4000000000000002 -> declined, others -> approved),
   * upserts Payment record without storing raw PAN/CVV,
   * updates Order to 'confirmed' if approved.
   */
  async simulatePayment(
    userId: string | Types.ObjectId,
    orderId: string,
    input: SimulatePaymentInput
  ): Promise<SimulatePaymentResult> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new AppError('Invalid order ID', 400);
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    if (order.user.toString() !== userObjId.toString()) {
      throw new AppError('You do not have access to this order', 403);
    }

    const existingPayment = await Payment.findOne({ order: order._id });

    // If order is already paid/confirmed
    if (order.status === 'confirmed') {
      if (existingPayment && existingPayment.status === 'approved') {
        if (existingPayment.method === 'simulated_online') {
          return {
            order,
            payment: existingPayment,
            approved: true,
          };
        }
        throw new AppError('Order is already paid; cannot submit another payment', 409);
      }
    }

    if (order.status !== 'pending_payment') {
      throw new AppError(`Cannot process payment for order in '${order.status}' status`, 409);
    }

    if (existingPayment) {
      if (existingPayment.status === 'submitted') {
        throw new AppError('A payment slip has already been submitted and is under review', 409);
      }
      if (existingPayment.status === 'approved') {
        throw new AppError('Order is already paid; cannot submit another payment', 409);
      }
    }

    const approved = input.cardNumber !== '4000000000000002';
    const gatewayResponseCode = approved ? '00_success' : 'card_declined';
    const transactionId = approved ? randomUUID() : 'declined';
    const maskedCardLast4 = input.cardNumber.slice(-4);
    const paymentStatus = approved ? 'approved' : 'rejected';

    const payment = await Payment.findOneAndUpdate(
      { order: order._id },
      {
        $set: {
          order: order._id,
          method: 'simulated_online',
          status: paymentStatus,
          amount: order.total,
          transactionId,
          maskedCardLast4,
          gatewayResponseCode,
          pointsUsed: null,
          walletTransaction: null,
          slipImageUrl: null,
          reviewedBy: null,
          reviewedAt: approved ? new Date() : null,
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    let updatedOrder = order;
    if (approved) {
      assertTransition(order.status, 'confirmed', 'customer', true);
      const confirmedOrder = await Order.findByIdAndUpdate(
        order._id,
        { status: 'confirmed' },
        { new: true }
      );
      if (confirmedOrder) {
        updatedOrder = confirmedOrder;
      }
      // Generate invoice
      await invoiceService.generateInvoice(updatedOrder, payment!);
    }

    return {
      order: updatedOrder,
      payment: payment!,
      approved,
    };
  },

  /**
   * Centrally guarded order status transition with RBAC, customer self-cancel,
   * inventory restock on cancellation, and payment status sync on slip review.
   */
  async transitionStatus(
    user: IUser,
    orderId: string,
    targetStatus: OrderStatus,
    extra?: { trackingNumber?: string | null; reviewNote?: string | null }
  ): Promise<IOrder> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new AppError('Invalid order ID', 400);
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const isOwner = order.user.toString() === user._id.toString();

    // Customers can only cancel pending orders via this endpoint
    if (user.role === 'customer' && targetStatus !== 'cancelled') {
      throw new AppError('Customers can only cancel pending orders', 403);
    }

    // Assert transition validity and permissions (throws 400 on illegal pair, 403 on role unauthorized)
    assertTransition(order.status, targetStatus, user.role, isOwner);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. If cancelling, restock all items atomically with floor protection
      if (targetStatus === 'cancelled') {
        for (const item of order.items) {
          await inventoryService.adjustStock(
            item.product,
            item.variantSku,
            item.quantity,
            { session }
          );
        }
      }

      // 2. If bouncing back from payment_review to pending_payment (slip rejection)
      if (order.status === 'payment_review' && targetStatus === 'pending_payment') {
        const updateSet: Record<string, any> = {
          status: 'rejected',
          reviewedBy: user._id,
          reviewedAt: new Date(),
        };
        if (extra?.reviewNote !== undefined) {
          updateSet.reviewNote = extra.reviewNote;
        }
        await Payment.findOneAndUpdate(
          { order: order._id },
          { $set: updateSet },
          { session }
        );
      }

      // 3. If approving from payment_review to confirmed (slip approval)
      if (order.status === 'payment_review' && targetStatus === 'confirmed') {
        const updateSet: Record<string, any> = {
          status: 'approved',
          reviewedBy: user._id,
          reviewedAt: new Date(),
        };
        if (extra?.reviewNote !== undefined) {
          updateSet.reviewNote = extra.reviewNote;
        }
        await Payment.findOneAndUpdate(
          { order: order._id },
          { $set: updateSet },
          { session }
        );
      }

      // 4. If delivered, stamp deliveredAt
      if (targetStatus === 'delivered' && !order.deliveredAt) {
        order.deliveredAt = new Date();
      }

      // 5. If tracking number provided, record it
      if (extra?.trackingNumber !== undefined && extra.trackingNumber !== null) {
        order.trackingNumber = extra.trackingNumber;
      }

      order.status = targetStatus;
      await order.save({ session });

      // 6. If transitioning to 'confirmed', generate invoice record
      if (targetStatus === 'confirmed') {
        const confirmedPayment = await Payment.findOne({ order: order._id }).session(session);
        await invoiceService.generateInvoice(order, confirmedPayment, session);
      }

      await session.commitTransaction();
      return order;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  },

  /**
   * Get paginated orders for the authenticated customer (newest first).
   */
  async getMyOrders(
    userId: string | Types.ObjectId,
    query?: { page?: string | number; limit?: string | number }
  ): Promise<{ orders: IOrder[]; results: number; total: number; page: number; pages: number }> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    const page = Math.max(1, parseInt(String(query?.page || 1), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(query?.limit || 10), 10) || 10));
    const skip = (page - 1) * limit;

    const filter = { user: userObjId };

    const [total, orders] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ]);

    const pages = Math.ceil(total / limit) || 1;

    return {
      orders,
      results: orders.length,
      total,
      page,
      pages,
    };
  },

  /**
   * Get single order by ID with ownership check and delivery_manager field sanitization.
   */
  async getOrderById(
    user: IUser,
    orderId: string
  ): Promise<any> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new AppError('Invalid order ID', 400);
    }

    const order = await Order.findById(orderId).populate('user', 'name email');
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const orderUserId = (order.user as any)?._id?.toString() || order.user.toString();
    const isOwner = orderUserId === user._id.toString();

    // Plain customer can only view own orders
    if (user.role === 'customer' && !isOwner) {
      throw new AppError('You do not have access to this order', 403);
    }

    // delivery_manager sees only fields needed for fulfillment:
    // shipping address, items, status, tracking number, deliveredAt, user name
    if (user.role === 'delivery_manager') {
      return {
        _id: order._id,
        user: { name: (order.user as any)?.name || 'Customer' },
        items: order.items.map((item) => ({
          product: item.product,
          name: item.name,
          image: item.image,
          variantSku: item.variantSku,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
        })),
        shippingAddress: order.shippingAddress,
        status: order.status,
        trackingNumber: order.trackingNumber,
        deliveredAt: order.deliveredAt,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      };
    }

    const payment = await Payment.findOne({ order: order._id });
    const orderObj = order.toObject();
    (orderObj as any).payment = payment || null;
    return orderObj;
  },

  /**
   * Customer self-cancel or staff cancel order.
   * Delegates to transitionStatus which enforces P46 transition rules and inventory restocking.
   */
  async cancelOrder(user: IUser, orderId: string): Promise<IOrder> {
    return this.transitionStatus(user, orderId, 'cancelled');
  },

  /**
   * Get paginated orders for staff/admin with status and search filtering.
   */
  async getAdminOrders(query?: {
    page?: string | number;
    limit?: string | number;
    status?: string;
    search?: string;
  }): Promise<{ orders: any[]; results: number; total: number; page: number; pages: number }> {
    const page = Math.max(1, parseInt(String(query?.page || 1), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(query?.limit || 10), 10) || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (query?.status && query.status !== 'all') {
      filter.status = query.status;
    }

    if (query?.search && query.search.trim()) {
      const searchTerm = query.search.trim();
      const orConditions: any[] = [];

      if (Types.ObjectId.isValid(searchTerm)) {
        orConditions.push({ _id: new Types.ObjectId(searchTerm) });
      }

      orConditions.push({ trackingNumber: { $regex: searchTerm, $options: 'i' } });

      const matchingUsers = await User.find(
        {
          $or: [
            { name: { $regex: searchTerm, $options: 'i' } },
            { email: { $regex: searchTerm, $options: 'i' } },
          ],
        },
        '_id'
      );

      if (matchingUsers.length > 0) {
        orConditions.push({ user: { $in: matchingUsers.map((u) => u._id) } });
      }

      filter.$or = orConditions;
    }

    const [total, rawOrders] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter)
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    const orderIds = rawOrders.map((o) => o._id);
    const payments = await Payment.find({ order: { $in: orderIds } });
    const paymentMap = new Map(payments.map((p) => [p.order.toString(), p]));

    const orders = rawOrders.map((o) => {
      const obj = o.toObject();
      (obj as any).payment = paymentMap.get(o._id.toString()) || null;
      return obj;
    });

    const pages = Math.ceil(total / limit) || 1;

    return {
      orders,
      results: orders.length,
      total,
      page,
      pages,
    };
  },

  /**
   * Get fulfillment-scoped orders for delivery manager (and admin/owner).
   * Strictly restricts to fulfillment statuses [processing..delivered].
   * Never exposes pending_payment or payment_review orders.
   * Sanitizes pricing/payment data when accessed by delivery_manager role.
   */
  async getDeliveryOrders(
    user: IUser,
    query?: {
      page?: string | number;
      limit?: string | number;
      status?: string;
      search?: string;
    }
  ): Promise<{
    orders: any[];
    results: number;
    total: number;
    page: number;
    pages: number;
  }> {
    const page = Math.max(1, parseInt(String(query?.page || 1), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(query?.limit || 10), 10) || 10));
    const skip = (page - 1) * limit;

    const FULFILLMENT_RANGE: OrderStatus[] = [
      'processing',
      'ready_for_dispatch',
      'picked_up',
      'in_transit',
      'out_for_delivery',
    ];

    const ALL_DELIVERY_ALLOWED: OrderStatus[] = [...FULFILLMENT_RANGE, 'delivered'];

    const filter: Record<string, any> = {};

    if (query?.status && query.status !== 'all') {
      if (ALL_DELIVERY_ALLOWED.includes(query.status as OrderStatus)) {
        filter.status = query.status;
      } else {
        // Explicitly reject/exclude non-fulfillment statuses (pending_payment, payment_review, cancelled)
        filter.status = { $in: [] };
      }
    } else {
      // Default queue is active fulfillment pipeline [processing..out_for_delivery]
      filter.status = { $in: FULFILLMENT_RANGE };
    }

    if (query?.search && query.search.trim()) {
      const term = query.search.trim();
      const conditions: any[] = [];

      if (Types.ObjectId.isValid(term)) {
        conditions.push({ _id: new Types.ObjectId(term) });
      }

      const regex = { $regex: term, $options: 'i' };
      conditions.push({ trackingNumber: regex });
      conditions.push({ 'shippingAddress.city': regex });
      conditions.push({ 'shippingAddress.line1': regex });

      const matchingUsers = await User.find({
        $or: [{ name: regex }, { email: regex }],
      }).select('_id');
      if (matchingUsers.length > 0) {
        conditions.push({ user: { $in: matchingUsers.map((u) => u._id) } });
      }

      filter.$and = [{ $or: conditions }];
    }

    const [total, rawOrders] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter)
        .populate('user', 'name email')
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    const pages = Math.ceil(total / limit) || 1;

    // Delivery Manager gets sanitized view without financial totals
    const isDeliveryOnly = user.role === 'delivery_manager';

    const orders = rawOrders.map((o) => {
      if (isDeliveryOnly) {
        return {
          _id: o._id,
          user: {
            _id: (o.user as any)?._id,
            name: (o.user as any)?.name || 'Customer',
            email: (o.user as any)?.email || '',
          },
          items: o.items.map((item) => ({
            product: item.product,
            name: item.name,
            image: item.image,
            variantSku: item.variantSku,
            size: item.size,
            color: item.color,
            quantity: item.quantity,
          })),
          shippingAddress: o.shippingAddress,
          status: o.status,
          trackingNumber: o.trackingNumber,
          deliveredAt: o.deliveredAt,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
        };
      }
      return o.toObject();
    });

    return {
      orders,
      results: orders.length,
      total,
      page,
      pages,
    };
  },

  /**
   * Update tracking number on an order.
   * Authorized for delivery_manager, admin, and owner.
   */
  async updateTracking(
    user: IUser,
    orderId: string,
    trackingNumber: string
  ): Promise<any> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new AppError('Invalid order ID', 400);
    }

    const order = await Order.findById(orderId).populate('user', 'name email');
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    order.trackingNumber = trackingNumber.trim();
    await order.save();

    if (user.role === 'delivery_manager') {
      return {
        _id: order._id,
        user: {
          _id: (order.user as any)?._id,
          name: (order.user as any)?.name || 'Customer',
          email: (order.user as any)?.email || '',
        },
        items: order.items.map((item) => ({
          product: item.product,
          name: item.name,
          image: item.image,
          variantSku: item.variantSku,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
        })),
        shippingAddress: order.shippingAddress,
        status: order.status,
        trackingNumber: order.trackingNumber,
        deliveredAt: order.deliveredAt,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      };
    }

    return order.toObject();
  },
};


