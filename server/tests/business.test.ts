import mongoose from 'mongoose';
import { inventoryService } from '../src/services/inventory.service';
import { orderService } from '../src/services/order.service';
import { couponService } from '../src/services/coupon.service';
import { walletService } from '../src/services/wallet.service';
import Coupon from '../src/models/Coupon';
import { Product } from '../src/models/Product';
import { Order } from '../src/models/Order';
import { createProduct, createUser, createOrder } from './helpers';

describe('Business Logic & Money/Stock Integrity', () => {
  describe('Stock Lifecycle (Order Creation & Cancellation)', () => {
    it('decrements stock once on order creation and restores stock on order cancellation', async () => {
      const user = await createUser('customer');
      const product = await createProduct({ stock: 20 });
      const variantSku = product.variants[0].sku;
      const initialStock = product.variants[0].stock;
      const orderQty = 3;

      // 1. Create Order via orderService
      const result = await orderService.createOrder(user._id, {
        shippingAddressId: user.addresses[0]._id!.toString(),
        items: [
          {
            productId: product._id.toString(),
            variantSku,
            quantity: orderQty,
          },
        ],
      });

      expect(result.order).toBeDefined();
      expect(result.order.status).toBe('pending_payment');

      // Verify stock was decremented once
      const productAfterOrder = await Product.findById(product._id);
      const variantAfterOrder = productAfterOrder?.variants.find((v) => v.sku === variantSku);
      expect(variantAfterOrder?.stock).toBe(initialStock - orderQty);

      // 2. Cancel Order
      await orderService.cancelOrder(user, result.order._id.toString());

      // Verify stock was restored to initialStock
      const productAfterCancel = await Product.findById(product._id);
      const variantAfterCancel = productAfterCancel?.variants.find((v) => v.sku === variantSku);
      expect(variantAfterCancel?.stock).toBe(initialStock);

      // Verify order status is cancelled
      const cancelledOrder = await Order.findById(result.order._id);
      expect(cancelledOrder?.status).toBe('cancelled');
    });

    it('prevents stock decrement below zero with 409 error', async () => {
      const product = await createProduct({ stock: 2 });
      const variantSku = product.variants[0].sku;

      await expect(
        inventoryService.adjustStock(product._id, variantSku, -5)
      ).rejects.toThrow(/insufficient stock/i);

      // Stock remains untouched at 2
      const freshProduct = await Product.findById(product._id);
      expect(freshProduct?.variants[0].stock).toBe(2);
    });
  });

  describe('Coupon Usage Limits', () => {
    it('rejects coupon application once global usage limit is reached', async () => {
      const user = await createUser('customer');
      const code = `LIMIT${Date.now()}`.toUpperCase();

      const coupon = await Coupon.create({
        code,
        discountType: 'fixed',
        discountValue: 100,
        minOrderAmount: 200,
        usageLimit: 2,
        validUntil: new Date(Date.now() + 86400000 * 30),
      });

      // Initially valid (0 usages)
      const check1 = await couponService.validateCoupon(code, user._id.toString(), 500);
      expect(check1.valid).toBe(true);

      // Simulate 2 confirmed orders using this coupon
      await createOrder(user, { couponCode: code, status: 'confirmed' });
      await createOrder(user, { couponCode: code, status: 'delivered' });

      // Third usage should be rejected as limit is reached
      const check2 = await couponService.validateCoupon(code, user._id.toString(), 500);
      expect(check2.valid).toBe(false);
      expect(check2.message).toMatch(/maximum usage limit/i);
    });
  });

  describe('Wallet Integrity & Idempotent Refunds', () => {
    it('prevents wallet debit from going negative', async () => {
      const user = await createUser('customer');

      // Initial credit of 50 points
      await walletService.credit({
        userId: user._id,
        points: 50,
        type: 'admin_credit',
        idempotencyKey: `init-${user._id}`,
        note: 'Welcome bonus',
      });

      const walletBefore = await walletService.getOrCreateWallet(user._id);
      expect(walletBefore.balancePoints).toBe(50);

      // Attempt to debit 100 points (exceeding balance)
      await expect(
        walletService.debit({
          userId: user._id,
          points: 100,
          type: 'order_spend',
          idempotencyKey: `debit-fail-${user._id}`,
          note: 'Oversized debit',
        })
      ).rejects.toThrow(/insufficient reward points balance/i);

      // Balance must remain strictly 50 (never negative)
      const walletAfter = await walletService.getOrCreateWallet(user._id);
      expect(walletAfter.balancePoints).toBe(50);
    });

    it('credits refund to wallet exactly once on idempotent retries', async () => {
      const user = await createUser('customer');
      const idempotencyKey = `refund-test-${Date.now()}`;
      const refundPoints = 250;

      // First refund credit
      const first = await walletService.credit({
        userId: user._id,
        points: refundPoints,
        type: 'refund_earn',
        idempotencyKey,
        note: 'Order refund points',
      });

      expect(first.wallet.balancePoints).toBe(refundPoints);

      // Second attempt with identical idempotencyKey (e.g. network retry / duplicate hook)
      const second = await walletService.credit({
        userId: user._id,
        points: refundPoints,
        type: 'refund_earn',
        idempotencyKey,
        note: 'Order refund points retry',
      });

      // Wallet balance must STILL be 250, not 500!
      expect(second.wallet.balancePoints).toBe(refundPoints);
      expect(second.transaction._id.toString()).toBe(first.transaction._id.toString());
    });
  });

  describe('Order Status Machine & Transition Guard', () => {
    it('rejects illegal status jumps (e.g., pending_payment directly to delivered)', async () => {
      const user = await createUser('admin');
      const order = await createOrder(user, { status: 'pending_payment' });

      await expect(
        orderService.transitionStatus(user, order._id.toString(), 'delivered')
      ).rejects.toThrow(/cannot transition|invalid.*transition/i);

      const freshOrder = await Order.findById(order._id);
      expect(freshOrder?.status).toBe('pending_payment');
    });

    it('rejects transitions out of terminal cancelled state', async () => {
      const user = await createUser('admin');
      const order = await createOrder(user, { status: 'cancelled' });

      await expect(
        orderService.transitionStatus(user, order._id.toString(), 'confirmed')
      ).rejects.toThrow(/cannot transition|invalid.*transition/i);

      const freshOrder = await Order.findById(order._id);
      expect(freshOrder?.status).toBe('cancelled');
    });

    it('permits valid linear transitions (confirmed -> processing -> ready_for_dispatch)', async () => {
      const user = await createUser('admin');
      const order = await createOrder(user, { status: 'confirmed' });

      const step1 = await orderService.transitionStatus(user, order._id.toString(), 'processing');
      expect(step1.status).toBe('processing');

      const step2 = await orderService.transitionStatus(user, order._id.toString(), 'ready_for_dispatch');
      expect(step2.status).toBe('ready_for_dispatch');
    });
  });
});
