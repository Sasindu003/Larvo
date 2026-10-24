import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import User from '../src/models/User';
import Order, { IOrder } from '../src/models/Order';
import { Product } from '../src/models/Product';
import { Category } from '../src/models/Category';
import { canTransition, assertTransition } from '../src/config/order-transitions';
import { env } from '../src/config/env';

function generateToken(userId: Types.ObjectId, role: string): string {
  return jwt.sign(
    { sub: userId.toString(), role },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Order Transition State Machine & RBAC', () => {
  let cust1Token: string;
  let cust2Token: string;
  let staffToken: string;
  let adminToken: string;
  let ownerToken: string;
  let deliveryToken: string;
  let supplierToken: string;

  let cust1: any;
  let cust2: any;
  let product: any;

  const createTestOrder = async (userId: Types.ObjectId, status: any = 'pending_payment'): Promise<IOrder> => {
    return Order.create({
      user: userId,
      items: [
        {
          product: product._id,
          name: product.name,
          image: product.images[0],
          variantSku: product.variants[0].sku,
          size: product.variants[0].size,
          color: product.variants[0].color,
          unitPrice: 100,
          quantity: 2,
        },
      ],
      shippingAddress: {
        line1: '123 Main St',
        city: 'Bangkok',
        province: 'Bangkok',
        postalCode: '10110',
        country: 'Thailand',
      },
      discountAmount: 0,
      subtotal: 200,
      shippingFee: 50,
      total: 250,
      status,
      pointsPaid: 0,
    });
  };

  beforeEach(async () => {
    const testSuffix = Date.now().toString() + Math.random().toString(36).slice(2, 6);

    let category = await Category.findOne();
    if (!category) {
      category = await Category.create({
        name: `Test Cat ${testSuffix}`,
        slug: `test-cat-${testSuffix}`,
        description: 'Test category description',
        department: new mongoose.Types.ObjectId(),
        image: 'https://example.com/cat.jpg',
      });
    }

    product = await Product.create({
      name: `Test Item ${testSuffix}`,
      slug: `test-item-${testSuffix}`,
      description: 'Test product description',
      category: category._id,
      images: ['https://example.com/test.jpg'],
      basePrice: 100,
      status: 'active',
      variants: [
        {
          size: 'M',
          color: 'Black',
          material: 'Cotton',
          sku: `SKU-${testSuffix}`,
          stock: 50,
        },
      ],
    });

    const users = await Promise.all([
      User.create({
        name: `Customer One ${testSuffix}`,
        email: `cust1_${testSuffix}@example.com`,
        role: 'customer',
        authProvider: 'local',
        active: true,
        addresses: [{ line1: '123 Main', city: 'BKK', province: 'BKK', postalCode: '10110', country: 'Thailand', isDefault: true }],
      }),
      User.create({
        name: `Customer Two ${testSuffix}`,
        email: `cust2_${testSuffix}@example.com`,
        role: 'customer',
        authProvider: 'local',
        active: true,
      }),
      User.create({
        name: `Staff User ${testSuffix}`,
        email: `staff_${testSuffix}@example.com`,
        role: 'staff',
        authProvider: 'local',
        active: true,
      }),
      User.create({
        name: `Admin User ${testSuffix}`,
        email: `admin_${testSuffix}@example.com`,
        role: 'admin',
        authProvider: 'local',
        active: true,
      }),
      User.create({
        name: `Owner User ${testSuffix}`,
        email: `owner_${testSuffix}@example.com`,
        role: 'owner',
        authProvider: 'local',
        active: true,
      }),
      User.create({
        name: `Delivery User ${testSuffix}`,
        email: `delivery_${testSuffix}@example.com`,
        role: 'delivery_manager',
        authProvider: 'local',
        active: true,
      }),
      User.create({
        name: `Supplier User ${testSuffix}`,
        email: `supplier_${testSuffix}@example.com`,
        role: 'supplier',
        authProvider: 'local',
        active: true,
      }),
    ]);

    [cust1, cust2] = users;
    cust1Token = generateToken(users[0]._id, 'customer');
    cust2Token = generateToken(users[1]._id, 'customer');
    staffToken = generateToken(users[2]._id, 'staff');
    adminToken = generateToken(users[3]._id, 'admin');
    ownerToken = generateToken(users[4]._id, 'owner');
    deliveryToken = generateToken(users[5]._id, 'delivery_manager');
    supplierToken = generateToken(users[6]._id, 'supplier');
  });

  describe('Section 1: Unit Tests on Transition Rules & Guards', () => {
    it('evaluates customer transition permissions correctly', () => {
      expect(canTransition('pending_payment', 'cancelled', 'customer', true)).toBe(true);
      expect(canTransition('pending_payment', 'cancelled', 'customer', false)).toBe(false);
      expect(canTransition('confirmed', 'cancelled', 'customer', true)).toBe(false);
      expect(canTransition('confirmed', 'processing', 'customer', true)).toBe(false);

      const custOwnerRule = assertTransition('pending_payment', 'cancelled', 'customer', true);
      expect(custOwnerRule.to).toBe('cancelled');

      expect(() => assertTransition('pending_payment', 'cancelled', 'customer', false)).toThrow();
      expect(() => assertTransition('confirmed', 'cancelled', 'customer', true)).toThrow();
    });

    it('evaluates staff transition permissions correctly', () => {
      const staffRule = assertTransition('confirmed', 'processing', 'staff', false);
      expect(staffRule.to).toBe('processing');

      const staffCancelReviewRule = assertTransition('payment_review', 'cancelled', 'staff', false);
      expect(staffCancelReviewRule.to).toBe('cancelled');

      expect(() => assertTransition('delivered', 'cancelled', 'staff', false)).toThrow();
    });

    it('evaluates delivery manager transition permissions correctly', () => {
      const dmRule1 = assertTransition('picked_up', 'in_transit', 'delivery_manager');
      expect(dmRule1.to).toBe('in_transit');

      const dmRule2 = assertTransition('in_transit', 'out_for_delivery', 'delivery_manager');
      expect(dmRule2.to).toBe('out_for_delivery');

      expect(() => assertTransition('confirmed', 'processing', 'delivery_manager')).toThrow();
    });

    it('rejects illegal status transitions', () => {
      expect(() => assertTransition('delivered', 'pending_payment', 'admin')).toThrow();
      expect(() => assertTransition('cancelled', 'confirmed', 'owner')).toThrow();
    });
  });

  describe('Section 2: HTTP Integration Tests — Customer Role', () => {
    it('rejects customer attempting non-cancel transitions with 403', async () => {
      const order = await createTestOrder(cust1._id, 'pending_payment');
      const nonCancelStatuses = ['processing', 'confirmed', 'ready_for_dispatch', 'delivered', 'payment_review', 'pending_payment'];

      for (const targetStatus of nonCancelStatuses) {
        const res = await request(app)
          .patch(`/api/orders/${order._id}/status`)
          .set('Authorization', `Bearer ${cust1Token}`)
          .send({ status: targetStatus });

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
      }
    });

    it('rejects customer cancelling another customer order with 403', async () => {
      const cust2Order = await createTestOrder(cust2._id, 'pending_payment');
      const res = await request(app)
        .patch(`/api/orders/${cust2Order._id}/status`)
        .set('Authorization', `Bearer ${cust1Token}`)
        .send({ status: 'cancelled' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('allows customer cancelling own pending_payment order and prevents trackingNumber injection', async () => {
      const order = await createTestOrder(cust1._id, 'pending_payment');
      const res = await request(app)
        .patch(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${cust1Token}`)
        .send({
          status: 'cancelled',
          trackingNumber: 'INJECTED_TRACKING_123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order.status).toBe('cancelled');
      expect(res.body.data.order.trackingNumber).not.toBe('INJECTED_TRACKING_123');
    });

    it('rejects customer cancelling confirmed or payment_review order with 403', async () => {
      const confirmedOrder = await createTestOrder(cust1._id, 'confirmed');
      const res1 = await request(app)
        .patch(`/api/orders/${confirmedOrder._id}/status`)
        .set('Authorization', `Bearer ${cust1Token}`)
        .send({ status: 'cancelled' });
      expect(res1.status).toBe(403);

      const reviewOrder = await createTestOrder(cust1._id, 'payment_review');
      const res2 = await request(app)
        .patch(`/api/orders/${reviewOrder._id}/status`)
        .set('Authorization', `Bearer ${cust1Token}`)
        .send({ status: 'cancelled' });
      expect(res2.status).toBe(403);
    });
  });

  describe('Section 3: HTTP Integration Tests — Staff Role', () => {
    it('allows staff to transition confirmed order to processing', async () => {
      const order = await createTestOrder(cust1._id, 'confirmed');
      const res = await request(app)
        .patch(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'processing' });

      expect(res.status).toBe(200);
      expect(res.body.data.order.status).toBe('processing');
    });

    it('allows staff to cancel pending and payment_review orders', async () => {
      const pendingOrder = await createTestOrder(cust1._id, 'pending_payment');
      const res1 = await request(app)
        .patch(`/api/orders/${pendingOrder._id}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'cancelled' });
      expect(res1.status).toBe(200);
      expect(res1.body.data.order.status).toBe('cancelled');

      const reviewOrder = await createTestOrder(cust1._id, 'payment_review');
      const res2 = await request(app)
        .patch(`/api/orders/${reviewOrder._id}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'cancelled' });
      expect(res2.status).toBe(200);
      expect(res2.body.data.order.status).toBe('cancelled');
    });

    it('rejects staff illegal transition with 400', async () => {
      const deliveredOrder = await createTestOrder(cust1._id, 'delivered');
      const res = await request(app)
        .patch(`/api/orders/${deliveredOrder._id}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'cancelled' });
      expect(res.status).toBe(400);
    });
  });

  describe('Section 4: HTTP Integration Tests — Admin Role', () => {
    it('allows admin to transition processing -> ready_for_dispatch', async () => {
      const order = await createTestOrder(cust1._id, 'processing');
      const res = await request(app)
        .patch(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ready_for_dispatch' });

      expect(res.status).toBe(200);
      expect(res.body.data.order.status).toBe('ready_for_dispatch');
    });

    it('allows admin to cancel processing order', async () => {
      const order = await createTestOrder(cust1._id, 'processing');
      const res = await request(app)
        .patch(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'cancelled' });

      expect(res.status).toBe(200);
      expect(res.body.data.order.status).toBe('cancelled');
    });
  });

  describe('Section 5: HTTP Integration Tests — Owner Role', () => {
    it('allows owner to transition ready_for_dispatch -> picked_up and cancel processing order', async () => {
      const order1 = await createTestOrder(cust1._id, 'ready_for_dispatch');
      const res1 = await request(app)
        .patch(`/api/orders/${order1._id}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'picked_up' });

      expect(res1.status).toBe(200);
      expect(res1.body.data.order.status).toBe('picked_up');

      const order2 = await createTestOrder(cust1._id, 'processing');
      const res2 = await request(app)
        .patch(`/api/orders/${order2._id}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'cancelled' });

      expect(res2.status).toBe(200);
      expect(res2.body.data.order.status).toBe('cancelled');
    });
  });

  describe('Section 6: HTTP Integration Tests — Delivery Manager Role', () => {
    it('allows delivery manager to advance picked_up -> in_transit -> out_for_delivery', async () => {
      const order = await createTestOrder(cust1._id, 'picked_up');
      const res1 = await request(app)
        .patch(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${deliveryToken}`)
        .send({ status: 'in_transit' });

      expect(res1.status).toBe(200);
      expect(res1.body.data.order.status).toBe('in_transit');

      const res2 = await request(app)
        .patch(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${deliveryToken}`)
        .send({ status: 'out_for_delivery' });

      expect(res2.status).toBe(200);
      expect(res2.body.data.order.status).toBe('out_for_delivery');
    });

    it('rejects delivery manager performing staff transition or cancellation with 403', async () => {
      const confirmedOrder = await createTestOrder(cust1._id, 'confirmed');
      const res1 = await request(app)
        .patch(`/api/orders/${confirmedOrder._id}/status`)
        .set('Authorization', `Bearer ${deliveryToken}`)
        .send({ status: 'processing' });
      expect(res1.status).toBe(403);

      const pendingOrder = await createTestOrder(cust1._id, 'pending_payment');
      const res2 = await request(app)
        .patch(`/api/orders/${pendingOrder._id}/status`)
        .set('Authorization', `Bearer ${deliveryToken}`)
        .send({ status: 'cancelled' });
      expect(res2.status).toBe(403);
    });
  });

  describe('Section 7: HTTP Integration Tests — Supplier & Unauthenticated', () => {
    it('rejects supplier access with 403 and unauthenticated access with 401', async () => {
      const order = await createTestOrder(cust1._id, 'pending_payment');

      const resSupplier = await request(app)
        .patch(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${supplierToken}`)
        .send({ status: 'cancelled' });
      expect(resSupplier.status).toBe(403);

      const resUnauth = await request(app)
        .patch(`/api/orders/${order._id}/status`)
        .send({ status: 'cancelled' });
      expect(resUnauth.status).toBe(401);
    });
  });
});
