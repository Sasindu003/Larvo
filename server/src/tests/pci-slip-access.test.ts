/// <reference types="jest" />
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../app';
import { env } from '../config/env';
import User from '../models/User';
import Order, { IOrder } from '../models/Order';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { uploadToGridFS } from '../services/gridfs.service';

// Minimal 1x1 valid PNG with valid PNG magic bytes
const VALID_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

function generateAuthToken(userId: Types.ObjectId, role = 'customer'): string {
  return jwt.sign(
    { sub: userId.toString(), role },
    env.JWT_SECRET || 'test-jwt-secret-key-12345678901234567890',
    { expiresIn: '1h' }
  );
}

async function createTestUser(role = 'customer', rand = Math.random().toString(36).slice(2, 8)) {
  return User.create({
    name: `Slip Test ${role} ${rand}`,
    email: `slip-${role}-${rand}@example.com`,
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
    role,
    active: true,
  });
}

async function createTestOrder(userId: Types.ObjectId, rand: string): Promise<IOrder> {
  let category = await Category.findOne();
  if (!category) {
    category = await Category.create({
      name: `Slip Category ${rand}`,
      slug: `slip-cat-${rand}`,
      description: `Slip Category description ${rand}`,
      image: 'https://example.com/cat.jpg',
      department: new Types.ObjectId(),
    });
  }

  const product = await Product.create({
    name: `Slip Item ${rand}`,
    slug: `slip-item-${rand}`,
    description: `Slip Item description ${rand}`,
    category: category._id,
    images: ['https://example.com/item.jpg'],
    basePrice: 500,
    status: 'active',
    variants: [
      {
        size: 'M',
        color: 'Navy',
        material: 'Cotton',
        sku: `SKU-SLIP-${rand.toUpperCase()}`,
        stock: 20,
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
        unitPrice: 500,
        quantity: 1,
        lineTotal: 500,
      },
    ],
    shippingAddress: {
      line1: '789 Transfer Road',
      city: 'Kandy',
      province: 'Central',
      postalCode: '20000',
      country: 'Sri Lanka',
    },
    discountAmount: 0,
    subtotal: 500,
    shippingFee: 60,
    total: 560,
    status: 'pending_payment',
    pointsPaid: 0,
  });
}

describe('PCI04: Payment Slip Isolation & Access Controls (pci-slip-access.test.ts)', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      const mongoUri = process.env.MONGO_URI || env.MONGO_URI || 'mongodb://localhost:27017/shop';
      await mongoose.connect(mongoUri);
    }
  });

  it('enforces strict private slip access: customer A (200), customer B (404), unauthenticated (404), staff (200)', async () => {
    const rand = Math.random().toString(36).slice(2, 8);
    const customerA = await createTestUser('customer', `a-${rand}`);
    const customerB = await createTestUser('customer', `b-${rand}`);
    const staffUser = await createTestUser('staff', `s-${rand}`);

    const tokenA = generateAuthToken(customerA._id as Types.ObjectId, 'customer');
    const tokenB = generateAuthToken(customerB._id as Types.ObjectId, 'customer');
    const tokenStaff = generateAuthToken(staffUser._id as Types.ObjectId, 'staff');

    const orderA = await createTestOrder(customerA._id as Types.ObjectId, rand);

    // 1. Upload payment slip as Customer A
    const uploadRes = await request(app)
      .post(`/api/orders/${orderA._id}/payment/slip`)
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('slip', VALID_PNG_BUFFER, 'customer_transfer_receipt.png');

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.success).toBe(true);

    const slipUrl: string = uploadRes.body.data.payment.slipImageUrl;
    expect(slipUrl).toBeDefined();
    expect(slipUrl).toMatch(/^\/api\/files\/payment-slips\/[a-f0-9]{24}$/i);

    // 2. Unauthenticated GET returns 404 (conceals existence)
    const unauthRes = await request(app).get(slipUrl);
    expect(unauthRes.status).toBe(404);

    // 3. Customer B GET returns 404 (conceals existence from unauthorized customer)
    const custBRes = await request(app)
      .get(slipUrl)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(custBRes.status).toBe(404);

    // 4. Customer A (order owner) GET returns 200 with private, no-store headers
    const custARes = await request(app)
      .get(slipUrl)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(custARes.status).toBe(200);
    expect(custARes.headers['cache-control']).toBeDefined();
    expect(custARes.headers['cache-control']).toContain('no-store');
    expect(custARes.headers['cache-control']).toContain('private');
    expect(custARes.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(custARes.headers['etag']).toBeUndefined();

    // 5. Staff GET returns 200 (allowed for payment review)
    const staffRes = await request(app)
      .get(slipUrl)
      .set('Authorization', `Bearer ${tokenStaff}`);
    expect(staffRes.status).toBe(200);
    expect(staffRes.headers['cache-control']).toContain('no-store');
  });

  it('allows public access without cookie for non-slip files (product images) with public immutable cache', async () => {
    // Seed a public product image in GridFS
    const publicFile = await uploadToGridFS(
      VALID_PNG_BUFFER,
      `product-photo-${Date.now()}.png`,
      'image/png',
      { type: 'product_image' }
    );

    const publicUrl = `/api/files/${publicFile.fileId}`;

    // Request without authentication or cookie
    const res = await request(app).get(publicUrl);

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBeDefined();
    expect(res.headers['cache-control']).toContain('public');
    expect(res.headers['cache-control']).toContain('immutable');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('rejects POST /api/files/upload with type: payment_slip to prevent uploading slips through public endpoint', async () => {
    const rand = Math.random().toString(36).slice(2, 8);
    const customer = await createTestUser('customer', rand);
    const token = generateAuthToken(customer._id as Types.ObjectId, 'customer');

    // Attempt to upload a payment_slip via generic upload endpoint
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'payment_slip')
      .attach('files', VALID_PNG_BUFFER, 'fake_slip.png');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/cannot be uploaded via generic upload endpoint/i);
  });
});
