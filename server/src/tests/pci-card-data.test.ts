/// <reference types="jest" />
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../app';
import { env } from '../config/env';
import User from '../models/User';
import Order, { IOrder } from '../models/Order';
import { Payment } from '../models/Payment';
import { Invoice } from '../models/Invoice';
import AuditLog from '../models/AuditLog';
import { Product } from '../models/Product';
import { Category } from '../models/Category';

// Helper: Luhn algorithm validator
export function passesLuhn(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits.charAt(i), 10);
    if (isNaN(n)) return false;
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

// Helper: Extract any 13-19 digit sequence that passes Luhn check
export function extractLuhnValidSequences(content: string): string[] {
  const digitRuns = content.match(/\d{13,19}/g) || [];
  return digitRuns.filter(passesLuhn);
}

function generateAuthToken(userId: Types.ObjectId, role = 'customer'): string {
  return jwt.sign(
    { sub: userId.toString(), role },
    env.JWT_SECRET || 'test-jwt-secret-key-12345678901234567890',
    { expiresIn: '1h' }
  );
}

async function createTestCustomer(rand: string) {
  return User.create({
    name: `Card Test Customer ${rand}`,
    email: `card-test-${rand}@example.com`,
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
    role: 'customer',
    active: true,
  });
}

async function createTestOrder(userId: Types.ObjectId, rand: string): Promise<IOrder> {
  let category = await Category.findOne();
  if (!category) {
    category = await Category.create({
      name: `PCI Category ${rand}`,
      slug: `pci-cat-${rand}`,
      description: `PCI Category description ${rand}`,
      image: 'https://example.com/cat.jpg',
      department: new Types.ObjectId(),
    });
  }

  const product = await Product.create({
    name: `PCI Item ${rand}`,
    slug: `pci-item-${rand}`,
    description: `PCI Item description ${rand}`,
    category: category._id,
    images: ['https://example.com/item.jpg'],
    basePrice: 1000,
    status: 'active',
    variants: [
      {
        size: 'L',
        color: 'Black',
        material: 'Cotton',
        sku: `SKU-PCI-${rand.toUpperCase()}`,
        stock: 10,
      },
    ],
  });

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
        unitPrice: 1000,
        quantity: 1,
        lineTotal: 1000,
      },
    ],
    shippingAddress: {
      line1: '456 PCI Boulevard',
      city: 'Colombo',
      province: 'Western',
      postalCode: '00300',
      country: 'Sri Lanka',
    },
    discountAmount: 0,
    subtotal: 1000,
    shippingFee: 60,
    total: 1060,
    status: 'pending_payment',
    pointsPaid: 0,
  });
}

describe('PCI04: Card Data Elimination & Simulator Guarantees (pci-card-data.test.ts)', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      const mongoUri = process.env.MONGO_URI || env.MONGO_URI || 'mongodb://localhost:27017/shop';
      await mongoose.connect(mongoUri);
    }
  });

  it('(a) POST simulate with raw cardholder data (cardNumber, cvv, expiry) returns 400 validation error', async () => {
    const rand = Math.random().toString(36).slice(2, 8);
    const customer = await createTestCustomer(rand);
    const order = await createTestOrder(customer._id as Types.ObjectId, rand);
    const token = generateAuthToken(customer._id as Types.ObjectId);

    // Attempt to submit raw card fields
    const res = await request(app)
      .post(`/api/orders/${order._id}/payment/simulate`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        cardNumber: '4242424242424242',
        cvv: '123',
        expiry: '12/28',
        cardholderName: 'Jane Doe',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation failed');
    // Ensure raw card values are not echoed in the error body
    expect(JSON.stringify(res.body)).not.toContain('4242424242424242');
  });

  it('(b) POST with tok_test_success confirms the order and returns maskedCardLast4 4242', async () => {
    const rand = Math.random().toString(36).slice(2, 8);
    const customer = await createTestCustomer(rand);
    const order = await createTestOrder(customer._id as Types.ObjectId, rand);
    const token = generateAuthToken(customer._id as Types.ObjectId);

    const res = await request(app)
      .post(`/api/orders/${order._id}/payment/simulate`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        token: 'tok_test_success',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.approved).toBe(true);
    expect(res.body.data.order.status).toBe('confirmed');
    expect(res.body.data.payment.maskedCardLast4).toBe('4242');
    expect(res.body.data.payment.status).toBe('approved');
    expect(res.body.data.payment.method).toBe('simulated_online');

    // (d) Scan raw Payment, Order, Invoice, and AuditLog documents
    const rawPayment = await Payment.findOne({ order: order._id }).lean();
    const rawOrder = await Order.findById(order._id).lean();
    const rawInvoice = await Invoice.findOne({ order: order._id }).lean();
    const rawAuditLogs = await AuditLog.find({ entityId: order._id.toString() }).lean();

    expect(rawPayment).toBeDefined();
    expect(rawOrder).toBeDefined();

    const paymentStr = JSON.stringify(rawPayment);
    const orderStr = JSON.stringify(rawOrder);
    const invoiceStr = rawInvoice ? JSON.stringify(rawInvoice) : '';
    const auditLogsStr = JSON.stringify(rawAuditLogs);

    // 1. Assert no 13-19 digit sequence passes Luhn check in any document
    expect(extractLuhnValidSequences(paymentStr)).toEqual([]);
    expect(extractLuhnValidSequences(orderStr)).toEqual([]);
    if (invoiceStr) {
      expect(extractLuhnValidSequences(invoiceStr)).toEqual([]);
    }
    expect(extractLuhnValidSequences(auditLogsStr)).toEqual([]);

    // 2. Assert no 'cvv' substring appears anywhere in stored records
    expect(paymentStr.toLowerCase()).not.toContain('cvv');
    expect(orderStr.toLowerCase()).not.toContain('cvv');
    if (invoiceStr) {
      expect(invoiceStr.toLowerCase()).not.toContain('cvv');
    }
    expect(auditLogsStr.toLowerCase()).not.toContain('cvv');
  });

  it('(c) POST with tok_test_decline leaves the order pending_payment', async () => {
    const rand = Math.random().toString(36).slice(2, 8);
    const customer = await createTestCustomer(rand);
    const order = await createTestOrder(customer._id as Types.ObjectId, rand);
    const token = generateAuthToken(customer._id as Types.ObjectId);

    const res = await request(app)
      .post(`/api/orders/${order._id}/payment/simulate`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        token: 'tok_test_decline',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.approved).toBe(false);
    expect(res.body.data.payment.status).toBe('rejected');
    expect(res.body.data.payment.maskedCardLast4).toBe('0002');

    // Verify order remains in pending_payment status in database
    const dbOrder = await Order.findById(order._id);
    expect(dbOrder?.status).toBe('pending_payment');
  });

  it('(e) with PAYMENT_SIMULATOR_ENABLED=false the route returns 404', async () => {
    const rand = Math.random().toString(36).slice(2, 8);
    const customer = await createTestCustomer(rand);
    const order = await createTestOrder(customer._id as Types.ObjectId, rand);
    const token = generateAuthToken(customer._id as Types.ObjectId);

    const originalSetting = env.PAYMENT_SIMULATOR_ENABLED;
    try {
      // Temporarily disable the payment simulator switch
      (env as Record<string, unknown>).PAYMENT_SIMULATOR_ENABLED = false;

      const res = await request(app)
        .post(`/api/orders/${order._id}/payment/simulate`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          token: 'tok_test_success',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not enabled|not found/i);
    } finally {
      (env as Record<string, unknown>).PAYMENT_SIMULATOR_ENABLED = originalSetting;
    }
  });
});
