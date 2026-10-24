import request from 'supertest';
import { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import User from '../src/models/User';
import Order from '../src/models/Order';
import ReturnRequest from '../src/models/ReturnRequest';
import { Wallet } from '../src/models/Wallet';
import {
  canReturnTransition,
  assertReturnTransition,
} from '../src/config/return-transitions';
import { returnService } from '../src/services/return.service';
import { env } from '../src/config/env';

function generateToken(userId: Types.ObjectId, role: string): string {
  return jwt.sign(
    { sub: userId.toString(), role },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Return Transition State Machine & Refund Logic', () => {
  describe('Section 1: Unit Tests on Return Transition Rules', () => {
    it('evaluates customer permissions correctly', () => {
      expect(canReturnTransition('requested', 'cancelled', 'customer', true)).toBe(true);
      expect(canReturnTransition('requested', 'cancelled', 'customer', false)).toBe(false);
      expect(canReturnTransition('requested', 'approved', 'customer', true)).toBe(false);
    });

    it('evaluates staff and delivery manager permissions correctly', () => {
      expect(canReturnTransition('requested', 'approved', 'staff')).toBe(true);
      expect(canReturnTransition('requested', 'rejected', 'staff')).toBe(true);
      expect(canReturnTransition('pickup_scheduled', 'picked_up', 'delivery_manager')).toBe(true);
      expect(canReturnTransition('picked_up', 'received', 'delivery_manager')).toBe(true);
    });

    it('evaluates admin refund permissions and disallows illegal skips', () => {
      expect(canReturnTransition('received', 'refunded', 'admin')).toBe(true);
      expect(canReturnTransition('refund_processing', 'refunded', 'admin')).toBe(true);
      expect(canReturnTransition('requested', 'refunded', 'admin')).toBe(false);
      expect(canReturnTransition('received', 'picked_up', 'admin')).toBe(false);
      expect(canReturnTransition('refunded', 'requested', 'admin')).toBe(false);
      expect(canReturnTransition('rejected', 'approved', 'admin')).toBe(false);
    });

    it('assertReturnTransition throws 400 on illegal transition and 403 on unauthorized role', () => {
      expect(() => assertReturnTransition('requested', 'refunded', 'admin')).toThrow();
      expect(() => assertReturnTransition('received', 'refunded', 'customer', true)).toThrow();
    });
  });

  describe('Section 2-5: Lifecycle Progression & Idempotent Refund Integration', () => {
    let customerA: any;
    let customerB: any;
    let adminUser: any;
    let tokenA: string;
    let tokenB: string;
    let testOrder: any;

    beforeEach(async () => {
      const suffix = Date.now().toString() + Math.random().toString(36).slice(2, 6);

      customerA = await User.create({
        name: 'Customer A',
        email: `custA_${suffix}@larvo.lk`,
        role: 'customer',
        authProvider: 'local',
        active: true,
        addresses: [
          {
            label: 'Home',
            line1: '123 Galle Road',
            city: 'Colombo 03',
            province: 'Western Province',
            postalCode: '00300',
            country: 'Sri Lanka',
            isDefault: true,
          },
        ],
      });

      customerB = await User.create({
        name: 'Customer B',
        email: `custB_${suffix}@larvo.lk`,
        role: 'customer',
        authProvider: 'local',
        active: true,
        addresses: [],
      });

      adminUser = await User.create({
        name: 'Admin Test',
        email: `admin_${suffix}@larvo.lk`,
        role: 'admin',
        authProvider: 'local',
        active: true,
      });

      tokenA = generateToken(customerA._id, 'customer');
      tokenB = generateToken(customerB._id, 'customer');

      testOrder = await Order.create({
        user: customerA._id,
        items: [
          {
            product: new Types.ObjectId(),
            name: 'Silk Linen Shirt',
            image: 'https://example.com/shirt.jpg',
            variantSku: 'SLS-M-BLU',
            size: 'M',
            color: 'Blue',
            unitPrice: 5000,
            quantity: 1,
            lineTotal: 5000,
          },
        ],
        shippingAddress: {
          label: 'Home',
          line1: '123 Galle Road',
          city: 'Colombo 03',
          province: 'Western Province',
          postalCode: '00300',
          country: 'Sri Lanka',
        },
        subtotal: 5000,
        shippingFee: 0,
        total: 5000,
        status: 'delivered',
        deliveredAt: new Date(),
      });
    });

    it('creates return request and populates DTO in GET /api/orders/:id with RBAC isolation', async () => {
      const returnRequest = await returnService.createReturnRequest(
        customerA._id,
        {
          orderId: testOrder._id.toString(),
          items: [{ orderItemRef: 0, qty: 1, reason: 'Size does not fit comfortably' }],
        }
      );

      expect(returnRequest.status).toBe('requested');
      expect(returnRequest.statusHistory.length).toBe(1);
      expect(returnRequest.statusHistory[0].status).toBe('requested');

      const getOrderResA = await request(app)
        .get(`/api/orders/${testOrder._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(getOrderResA.status).toBe(200);
      expect(getOrderResA.body.success).toBe(true);
      expect(getOrderResA.body.data.order.returnRequest).toBeDefined();
      expect(getOrderResA.body.data.order.returnRequest.status).toBe('requested');
      expect(getOrderResA.body.data.order.returnRequest.items[0].productName).toBe('Silk Linen Shirt');

      const getOrderResB = await request(app)
        .get(`/api/orders/${testOrder._id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(getOrderResB.status).toBe(403);
    });

    it('advances through approval, pickup, received and refunds idempotently with wallet credits', async () => {
      const returnRequest = await returnService.createReturnRequest(
        customerA._id,
        {
          orderId: testOrder._id.toString(),
          items: [{ orderItemRef: 0, qty: 1, reason: 'Size does not fit comfortably' }],
        }
      );

      const approvedReturn = await returnService.processReturnDecision(
        returnRequest._id.toString(),
        { decision: 'approved' }
      );
      expect(approvedReturn.status).toBe('pickup_scheduled');
      expect(approvedReturn.refundAmount).toBe(5000);

      const pickedUpReturn = await returnService.advanceReturnPickupStatus(
        returnRequest._id.toString(),
        'picked_up'
      );
      expect(pickedUpReturn.status).toBe('picked_up');

      const receivedReturn = await returnService.advanceReturnPickupStatus(
        returnRequest._id.toString(),
        'received'
      );
      expect(receivedReturn.status).toBe('received');

      const walletBefore = await Wallet.findOne({ user: customerA._id });
      const balanceBefore = walletBefore?.balancePoints || 0;

      const refunded1 = await returnService.processRefund(
        returnRequest._id.toString(),
        adminUser._id
      );
      expect(refunded1.status).toBe('refunded');
      expect(refunded1.refundedAt).toBeDefined();

      const walletAfter1 = await Wallet.findOne({ user: customerA._id });
      const balanceAfter1 = walletAfter1?.balancePoints || 0;
      expect(balanceAfter1).toBeGreaterThan(balanceBefore);

      const refunded2 = await returnService.processRefund(
        returnRequest._id.toString(),
        adminUser._id
      );
      expect(refunded2.status).toBe('refunded');

      const walletAfter2 = await Wallet.findOne({ user: customerA._id });
      const balanceAfter2 = walletAfter2?.balancePoints || 0;
      expect(balanceAfter2).toBe(balanceAfter1);
    });
  });

  describe('Section 6: Terminal Branches (Rejection, Inspection Failed, Cancellation)', () => {
    let customerA: any;
    let customerB: any;
    let adminUser: any;
    let tokenA: string;

    beforeEach(async () => {
      const suffix = Date.now().toString() + Math.random().toString(36).slice(2, 6);

      customerA = await User.create({
        name: 'Customer A',
        email: `custA_${suffix}@larvo.lk`,
        role: 'customer',
        authProvider: 'local',
        active: true,
        addresses: [
          {
            label: 'Home',
            line1: '123 Galle Road',
            city: 'Colombo 03',
            province: 'Western Province',
            postalCode: '00300',
            country: 'Sri Lanka',
            isDefault: true,
          },
        ],
      });

      customerB = await User.create({
        name: 'Customer B',
        email: `custB_${suffix}@larvo.lk`,
        role: 'customer',
        authProvider: 'local',
        active: true,
      });

      adminUser = await User.create({
        name: 'Admin Test',
        email: `admin_${suffix}@larvo.lk`,
        role: 'admin',
        authProvider: 'local',
        active: true,
      });

      tokenA = generateToken(customerA._id, 'customer');
    });

    it('handles return rejection correctly', async () => {
      const order = await Order.create({
        user: customerA._id,
        items: [
          {
            product: new Types.ObjectId(),
            name: 'Silk Linen Shirt',
            image: 'https://example.com/shirt.jpg',
            variantSku: 'SLS-M-BLU',
            size: 'M',
            color: 'Blue',
            unitPrice: 5000,
            quantity: 1,
            lineTotal: 5000,
          },
        ],
        shippingAddress: {
          label: 'Home',
          line1: '123 Galle Road',
          city: 'Colombo 03',
          province: 'Western Province',
          postalCode: '00300',
          country: 'Sri Lanka',
        },
        subtotal: 5000,
        shippingFee: 0,
        total: 5000,
        status: 'delivered',
        deliveredAt: new Date(),
      });

      const returnReq = await returnService.createReturnRequest(customerA._id, {
        orderId: order._id.toString(),
        items: [{ orderItemRef: 0, qty: 1, reason: 'Size too small' }],
      });

      const rejected = await returnService.processReturnDecision(returnReq._id.toString(), {
        decision: 'rejected',
        rejectionReason: 'Item condition not eligible for return',
      });

      expect(rejected.status).toBe('rejected');
      expect(rejected.rejectionReason).toBe('Item condition not eligible for return');

      const res = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.body.data.order.returnRequest.status).toBe('rejected');
      expect(res.body.data.order.returnRequest.rejectionReason).toBe('Item condition not eligible for return');
    });

    it('handles inspection failure correctly', async () => {
      const order = await Order.create({
        user: customerA._id,
        items: [
          {
            product: new Types.ObjectId(),
            name: 'Cotton T-Shirt',
            image: 'https://example.com/tee.jpg',
            variantSku: 'CTS-L-BLK',
            size: 'L',
            color: 'Black',
            unitPrice: 3000,
            quantity: 1,
            lineTotal: 3000,
          },
        ],
        shippingAddress: {
          label: 'Home',
          line1: '123 Galle Road',
          city: 'Colombo 03',
          province: 'Western Province',
          postalCode: '00300',
          country: 'Sri Lanka',
        },
        subtotal: 3000,
        shippingFee: 0,
        total: 3000,
        status: 'delivered',
        deliveredAt: new Date(),
      });

      const returnReq = await returnService.createReturnRequest(customerA._id, {
        orderId: order._id.toString(),
        items: [{ orderItemRef: 0, qty: 1, reason: 'Defective stitching' }],
      });

      await returnService.processReturnDecision(returnReq._id.toString(), { decision: 'approved' });
      await returnService.advanceReturnPickupStatus(returnReq._id.toString(), 'picked_up');
      await returnService.advanceReturnPickupStatus(returnReq._id.toString(), 'received');

      const inspectFailed = await returnService.transitionReturnStatus(
        returnReq._id.toString(),
        'inspection_failed',
        { userId: adminUser._id, role: 'staff' },
        { rejectionReason: 'Item showed signs of wear and tear, failing quality check' }
      );

      expect(inspectFailed.status).toBe('inspection_failed');

      const res = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.body.data.order.returnRequest.status).toBe('inspection_failed');
      expect(res.body.data.order.returnRequest.rejectionReason).toBe('Item showed signs of wear and tear, failing quality check');
    });

    it('handles customer self-cancellation and rejects non-owner cancellation', async () => {
      const order = await Order.create({
        user: customerA._id,
        items: [
          {
            product: new Types.ObjectId(),
            name: 'Classic Chinos',
            image: 'https://example.com/chinos.jpg',
            variantSku: 'CC-32-KHK',
            size: '32',
            color: 'Khaki',
            unitPrice: 4500,
            quantity: 1,
            lineTotal: 4500,
          },
        ],
        shippingAddress: {
          label: 'Home',
          line1: '123 Galle Road',
          city: 'Colombo 03',
          province: 'Western Province',
          postalCode: '00300',
          country: 'Sri Lanka',
        },
        subtotal: 4500,
        shippingFee: 0,
        total: 4500,
        status: 'delivered',
        deliveredAt: new Date(),
      });

      const returnReq = await returnService.createReturnRequest(customerA._id, {
        orderId: order._id.toString(),
        items: [{ orderItemRef: 0, qty: 1, reason: 'Changed my mind' }],
      });

      await expect(
        returnService.transitionReturnStatus(
          returnReq._id.toString(),
          'cancelled',
          { userId: customerB._id, role: 'customer' }
        )
      ).rejects.toThrow();

      const cancelled = await returnService.transitionReturnStatus(
        returnReq._id.toString(),
        'cancelled',
        { userId: customerA._id, role: 'customer' },
        { note: 'Customer decided to keep the item' }
      );

      expect(cancelled.status).toBe('cancelled');

      await expect(
        returnService.transitionReturnStatus(
          returnReq._id.toString(),
          'requested',
          { userId: customerA._id, role: 'customer' }
        )
      ).rejects.toThrow();
    });
  });
});
