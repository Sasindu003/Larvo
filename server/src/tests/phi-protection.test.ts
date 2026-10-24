/// <reference types="jest" />
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../app';
import { env } from '../config/env';
import User from '../models/User';
import Order from '../models/Order';
import Invoice from '../models/Invoice';
import Supplier from '../models/Supplier';
import ReturnRequest from '../models/ReturnRequest';
import AuditLog from '../models/AuditLog';
import { Category } from '../models/Category';
import { Product } from '../models/Product';
import { isEncrypted, decryptField, parseKeyRing, getKeyRing, resetKeyRing } from '../utils/fieldCrypto';

function generateAuthToken(userId: Types.ObjectId, role = 'customer'): string {
  return jwt.sign(
    { sub: userId.toString(), role },
    env.JWT_SECRET || 'test-jwt-secret-key-12345678901234567890',
    { expiresIn: '1h' }
  );
}

const ENC_REGEX = /^enc:v[0-9]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/;

async function createTestCategory(rand: string) {
  let category = await Category.findOne();
  if (!category) {
    category = await Category.create({
      name: `PHI Cat ${rand}`,
      slug: `phi-cat-${rand}`,
      description: `Category ${rand}`,
      image: 'https://example.com/cat.jpg',
      department: new Types.ObjectId(),
    });
  }
  return category;
}

async function createTestProduct(category: any, rand: string) {
  return Product.create({
    name: `PHI Apparel ${rand}`,
    slug: `phi-apparel-${rand}`,
    description: `Product ${rand}`,
    category: category._id,
    images: ['https://example.com/item.jpg'],
    basePrice: 2000,
    status: 'active',
    variants: [
      {
        size: 'M',
        color: 'Navy',
        material: 'Cotton',
        sku: `SKU-PHI-${rand.toUpperCase()}`,
        stock: 20,
      },
    ],
  });
}

describe('HIPAA / PHI Protection & Column-Level Access Control (phi-protection.test.ts)', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      const mongoUri = process.env.MONGO_URI || env.MONGO_URI || 'mongodb://localhost:27017/shop';
      await mongoose.connect(mongoUri);
    }
  });

  describe('1. At-Rest AES-256-GCM Encryption Across All Sensitive Collections', () => {
    it('encrypts Order shippingAddress (line1, line2, phone) at rest in raw MongoDB', async () => {
      const rand = Math.random().toString(36).slice(2, 8);
      const user = await User.create({
        name: `Cust ${rand}`,
        email: `cust-${rand}@example.com`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
        role: 'customer',
        active: true,
      });

      const category = await createTestCategory(rand);
      const product = await createTestProduct(category, rand);

      const plainLine1 = '100 Lotus Tower Boulevard';
      const plainLine2 = 'Penthouse Suite 14';
      const plainPhone = '0771234567';

      const order = await Order.create({
        user: user._id,
        items: [
          {
            product: product._id,
            name: product.name,
            image: product.images[0],
            variantSku: product.variants[0].sku,
            size: product.variants[0].size,
            color: product.variants[0].color,
            unitPrice: 2000,
            quantity: 1,
            lineTotal: 2000,
          },
        ],
        shippingAddress: {
          line1: plainLine1,
          line2: plainLine2,
          city: 'Colombo',
          province: 'Western',
          postalCode: '00100',
          country: 'Sri Lanka',
          phone: plainPhone,
        },
        discountAmount: 0,
        subtotal: 2000,
        shippingFee: 200,
        total: 2200,
        status: 'processing',
        pointsPaid: 0,
      });

      // Direct raw MongoDB query bypassing Mongoose hooks
      const rawOrder = await mongoose.connection.collection('orders').findOne({ _id: order._id });
      expect(rawOrder).toBeDefined();
      expect(isEncrypted(rawOrder?.shippingAddress?.line1)).toBe(true);
      expect(isEncrypted(rawOrder?.shippingAddress?.line2)).toBe(true);
      expect(isEncrypted(rawOrder?.shippingAddress?.phone)).toBe(true);
      expect(rawOrder?.shippingAddress?.line1).toMatch(ENC_REGEX);

      // Verify raw JSON string does not contain plaintext values
      const rawString = JSON.stringify(rawOrder);
      expect(rawString).not.toContain(plainLine1);
      expect(rawString).not.toContain(plainLine2);
      expect(rawString).not.toContain(plainPhone);

      // Verify authenticated decryption matches original values
      expect(decryptField(rawOrder?.shippingAddress?.line1, 'Order.shippingAddress.line1')).toBe(plainLine1);
      expect(decryptField(rawOrder?.shippingAddress?.line2, 'Order.shippingAddress.line2')).toBe(plainLine2);
      expect(decryptField(rawOrder?.shippingAddress?.phone, 'Order.shippingAddress.phone')).toBe(plainPhone);
    });

    it('encrypts Invoice snapshot shippingAddress (line1, line2, phone) at rest in raw MongoDB', async () => {
      const rand = Math.random().toString(36).slice(2, 8);
      const user = await User.create({
        name: `Inv Cust ${rand}`,
        email: `inv-cust-${rand}@example.com`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
        role: 'customer',
        active: true,
      });

      const plainLine1 = '25 Galle Face Terrace';
      const plainLine2 = 'Apartment 8C';
      const plainPhone = '0719876543';

      const invoice = await Invoice.create({
        invoiceNumber: `INV-PHI-${rand.toUpperCase()}`,
        order: new Types.ObjectId(),
        user: user._id,
        snapshot: {
          items: [
            {
              product: new Types.ObjectId(),
              name: 'Silk Shirt',
              image: 'https://example.com/shirt.jpg',
              variantSku: `SKU-INV-${rand}`,
              size: 'M',
              color: 'White',
              unitPrice: 3500,
              quantity: 1,
            },
          ],
          shippingAddress: {
            line1: plainLine1,
            line2: plainLine2,
            city: 'Colombo',
            province: 'Western',
            postalCode: '00300',
            country: 'Sri Lanka',
            phone: plainPhone,
          },
          subtotal: 3500,
          discountAmount: 0,
          shippingFee: 250,
          total: 3750,
          paymentStatus: 'paid',
          paymentMethod: 'card',
        },
      });

      const rawInvoice = await mongoose.connection.collection('invoices').findOne({ _id: invoice._id });
      expect(rawInvoice).toBeDefined();
      expect(isEncrypted(rawInvoice?.snapshot?.shippingAddress?.line1)).toBe(true);
      expect(isEncrypted(rawInvoice?.snapshot?.shippingAddress?.line2)).toBe(true);
      expect(isEncrypted(rawInvoice?.snapshot?.shippingAddress?.phone)).toBe(true);
      expect(rawInvoice?.snapshot?.shippingAddress?.line1).toMatch(ENC_REGEX);

      const rawString = JSON.stringify(rawInvoice);
      expect(rawString).not.toContain(plainLine1);
      expect(rawString).not.toContain(plainLine2);
      expect(rawString).not.toContain(plainPhone);

      expect(decryptField(rawInvoice?.snapshot?.shippingAddress?.line1, 'Invoice.snapshot.shippingAddress.line1')).toBe(plainLine1);
      expect(decryptField(rawInvoice?.snapshot?.shippingAddress?.line2, 'Invoice.snapshot.shippingAddress.line2')).toBe(plainLine2);
      expect(decryptField(rawInvoice?.snapshot?.shippingAddress?.phone, 'Invoice.snapshot.shippingAddress.phone')).toBe(plainPhone);
    });

    it('encrypts User addresses (line1, line2, phone) at rest in raw MongoDB', async () => {
      const rand = Math.random().toString(36).slice(2, 8);
      const plainLine1 = '78 Flower Road';
      const plainLine2 = 'Villa 2';
      const plainPhone = '0773344556';

      const user = await User.create({
        name: `User ${rand}`,
        email: `user-${rand}@example.com`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
        role: 'customer',
        active: true,
        addresses: [
          {
            label: 'Home',
            line1: plainLine1,
            line2: plainLine2,
            city: 'Colombo',
            province: 'Western',
            postalCode: '00700',
            country: 'Sri Lanka',
            phone: plainPhone,
            isDefault: true,
          },
        ],
      });

      const rawUser = await mongoose.connection.collection('users').findOne({ _id: user._id });
      expect(isEncrypted(rawUser?.addresses?.[0]?.line1)).toBe(true);
      expect(isEncrypted(rawUser?.addresses?.[0]?.line2)).toBe(true);
      expect(isEncrypted(rawUser?.addresses?.[0]?.phone)).toBe(true);

      const rawString = JSON.stringify(rawUser);
      expect(rawString).not.toContain(plainLine1);
      expect(rawString).not.toContain(plainLine2);
      expect(rawString).not.toContain(plainPhone);
    });

    it('encrypts Supplier contact details (phone, address) at rest in raw MongoDB', async () => {
      const rand = Math.random().toString(36).slice(2, 8);
      const plainPhone = '0112345678';
      const plainAddress = 'Industrial Zone 4, Export Processing Zone, Biyagama';

      const supplier = await Supplier.create({
        name: `Contact ${rand}`,
        companyName: `Fabric Mill ${rand} Industries`,
        email: `supplier-${rand}@mill.lk`,
        phone: plainPhone,
        address: plainAddress,
        status: 'active',
      });

      const rawSupplier = await mongoose.connection.collection('suppliers').findOne({ _id: supplier._id });
      expect(isEncrypted(rawSupplier?.phone)).toBe(true);
      expect(isEncrypted(rawSupplier?.address)).toBe(true);

      const rawString = JSON.stringify(rawSupplier);
      expect(rawString).not.toContain(plainPhone);
      expect(rawString).not.toContain(plainAddress);

      expect(decryptField(rawSupplier?.phone, 'Supplier.phone')).toBe(plainPhone);
      expect(decryptField(rawSupplier?.address, 'Supplier.address')).toBe(plainAddress);
    });

    it('encrypts ReturnRequest pickup (address, phone) at rest in raw MongoDB', async () => {
      const rand = Math.random().toString(36).slice(2, 8);
      const user = await User.create({
        name: `Ret Cust ${rand}`,
        email: `ret-${rand}@example.com`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
        role: 'customer',
        active: true,
      });

      const plainAddress = '44 Marine Drive, Bambalapitiya';
      const plainPhone = '0779988776';

      const returnReq = await ReturnRequest.create({
        order: new Types.ObjectId(),
        user: user._id,
        items: [
          {
            orderItemRef: 0,
            sku: `SKU-RET-${rand}`,
            qty: 1,
            reason: 'wrong_size',
          },
        ],
        pickup: {
          courier: 'Pronto Delivery',
          waybill: `WB-${rand}`,
          address: plainAddress,
          phone: plainPhone,
        },
        status: 'pickup_scheduled',
      });

      const rawReturn = await mongoose.connection.collection('returnrequests').findOne({ _id: returnReq._id });
      expect(isEncrypted(rawReturn?.pickup?.address)).toBe(true);
      expect(isEncrypted(rawReturn?.pickup?.phone)).toBe(true);

      const rawString = JSON.stringify(rawReturn);
      expect(rawString).not.toContain(plainAddress);
      expect(rawString).not.toContain(plainPhone);

      expect(decryptField(rawReturn?.pickup?.address, 'ReturnRequest.pickup.address')).toBe(plainAddress);
      expect(decryptField(rawReturn?.pickup?.phone, 'ReturnRequest.pickup.phone')).toBe(plainPhone);
    });
  });

  describe('2. Column-Level Access Control (Least Privilege Response Sanitization)', () => {
    it('allows customer (record owner) FULL plaintext access to their own order details', async () => {
      const rand = Math.random().toString(36).slice(2, 8);
      const customer = await User.create({
        name: `Owner Cust ${rand}`,
        email: `own-cust-${rand}@example.com`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
        role: 'customer',
        active: true,
      });

      const category = await createTestCategory(rand);
      const product = await createTestProduct(category, rand);

      const plainLine1 = '99 Baseline Road';
      const plainLine2 = 'Floor 3';
      const plainPhone = '0775551234';

      const order = await Order.create({
        user: customer._id,
        items: [
          {
            product: product._id,
            name: product.name,
            image: product.images[0],
            variantSku: product.variants[0].sku,
            size: product.variants[0].size,
            color: product.variants[0].color,
            unitPrice: 2000,
            quantity: 1,
            lineTotal: 2000,
          },
        ],
        shippingAddress: {
          line1: plainLine1,
          line2: plainLine2,
          city: 'Colombo',
          province: 'Western',
          postalCode: '00800',
          country: 'Sri Lanka',
          phone: plainPhone,
        },
        discountAmount: 0,
        subtotal: 2000,
        shippingFee: 150,
        total: 2150,
        status: 'processing',
        pointsPaid: 0,
      });

      const token = generateAuthToken(customer._id as Types.ObjectId, 'customer');
      const res = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order.shippingAddress.line1).toBe(plainLine1);
      expect(res.body.data.order.shippingAddress.line2).toBe(plainLine2);
      expect(res.body.data.order.shippingAddress.phone).toBe(plainPhone);
    });

    it('serves staff FULL address for fulfillment but MASKS contact phone and email', async () => {
      const rand = Math.random().toString(36).slice(2, 8);
      const customer = await User.create({
        name: `Cust For Staff ${rand}`,
        email: `cust-staff-${rand}@example.com`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
        role: 'customer',
        active: true,
      });

      const staff = await User.create({
        name: `Staff Member ${rand}`,
        email: `staff-${rand}@example.com`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
        role: 'staff',
        active: true,
      });

      const category = await createTestCategory(rand);
      const product = await createTestProduct(category, rand);

      const plainLine1 = '99 Baseline Road';
      const plainLine2 = 'Floor 3';
      const plainPhone = '0775551234';

      const order = await Order.create({
        user: customer._id,
        items: [
          {
            product: product._id,
            name: product.name,
            image: product.images[0],
            variantSku: product.variants[0].sku,
            size: product.variants[0].size,
            color: product.variants[0].color,
            unitPrice: 2000,
            quantity: 1,
            lineTotal: 2000,
          },
        ],
        shippingAddress: {
          line1: plainLine1,
          line2: plainLine2,
          city: 'Colombo',
          province: 'Western',
          postalCode: '00800',
          country: 'Sri Lanka',
          phone: plainPhone,
        },
        discountAmount: 0,
        subtotal: 2000,
        shippingFee: 150,
        total: 2150,
        status: 'processing',
        pointsPaid: 0,
      });

      const token = generateAuthToken(staff._id as Types.ObjectId, 'staff');
      const res = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Address street is visible for packing/shipping
      expect(res.body.data.order.shippingAddress.line1).toBe(plainLine1);
      expect(res.body.data.order.shippingAddress.line2).toBe(plainLine2);
      // Phone is masked (trailing 3 digits only)
      expect(res.body.data.order.shippingAddress.phone).not.toBe(plainPhone);
      expect(res.body.data.order.shippingAddress.phone).toBe('*******234');
      // User email if present is masked
      if (res.body.data.order.user?.email) {
        expect(res.body.data.order.user.email).toMatch(/^[a-z]\*\*\*@/i);
      }
    });

    it('enforces CONDITIONAL masking for delivery manager: HIDDEN when processing, FULL when in_transit', async () => {
      const rand = Math.random().toString(36).slice(2, 8);
      const customer = await User.create({
        name: `Cust For Delivery ${rand}`,
        email: `cust-del-${rand}@example.com`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
        role: 'customer',
        active: true,
      });

      const delivery = await User.create({
        name: `Delivery Driver ${rand}`,
        email: `del-driver-${rand}@example.com`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
        role: 'delivery_manager',
        active: true,
      });

      const category = await createTestCategory(rand);
      const product = await createTestProduct(category, rand);

      const plainLine1 = '99 Baseline Road';
      const plainLine2 = 'Floor 3';
      const plainPhone = '0775551234';

      const order = await Order.create({
        user: customer._id,
        items: [
          {
            product: product._id,
            name: product.name,
            image: product.images[0],
            variantSku: product.variants[0].sku,
            size: product.variants[0].size,
            color: product.variants[0].color,
            unitPrice: 2000,
            quantity: 1,
            lineTotal: 2000,
          },
        ],
        shippingAddress: {
          line1: plainLine1,
          line2: plainLine2,
          city: 'Colombo',
          province: 'Western',
          postalCode: '00800',
          country: 'Sri Lanka',
          phone: plainPhone,
        },
        discountAmount: 0,
        subtotal: 2000,
        shippingFee: 150,
        total: 2150,
        status: 'processing',
        pointsPaid: 0,
      });

      const token = generateAuthToken(delivery._id as Types.ObjectId, 'delivery_manager');

      // State 1: processing (not dispatched yet) -> address line1 and phone are HIDDEN (omitted)
      const resPending = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(resPending.status).toBe(200);
      expect(resPending.body.data.order.shippingAddress.line1).toBeUndefined();
      expect(resPending.body.data.order.shippingAddress.phone).toBeUndefined();
      expect(resPending.body.data.order.shippingAddress.city).toBe('Colombo');

      // State 2: update order to in_transit
      order.status = 'in_transit';
      await order.save();

      const resTransit = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(resTransit.status).toBe(200);
      expect(resTransit.body.data.order.shippingAddress.line1).toBe(plainLine1);
      expect(resTransit.body.data.order.shippingAddress.phone).toBe(plainPhone);
    });
  });

  describe('3. PII Read Auditing & Keyring Resolution', () => {
    it('creates an AuditLog entry with action PII_READ when staff accesses customer personal details', async () => {
      const rand = Math.random().toString(36).slice(2, 8);
      const staff = await User.create({
        name: `Audit Staff ${rand}`,
        email: `audit-staff-${rand}@example.com`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
        role: 'staff',
        active: true,
      });

      const customer = await User.create({
        name: `Audit Customer ${rand}`,
        email: `audit-cust-${rand}@example.com`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
        role: 'customer',
        active: true,
      });

      const category = await createTestCategory(rand);
      const product = await createTestProduct(category, rand);

      const order = await Order.create({
        user: customer._id,
        items: [
          {
            product: product._id,
            name: product.name,
            image: product.images[0],
            variantSku: product.variants[0].sku,
            size: product.variants[0].size,
            color: product.variants[0].color,
            unitPrice: 2000,
            quantity: 1,
            lineTotal: 2000,
          },
        ],
        shippingAddress: {
          line1: '12 Temple Trees',
          city: 'Colombo',
          province: 'Western',
          postalCode: '00300',
          country: 'Sri Lanka',
          phone: '0770001122',
        },
        discountAmount: 0,
        subtotal: 2000,
        shippingFee: 100,
        total: 2100,
        status: 'processing',
        pointsPaid: 0,
      });

      const token = generateAuthToken(staff._id as Types.ObjectId, 'staff');
      await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${token}`);

      // Allow async fire-and-forget audit logger to persist
      await new Promise((resolve) => setTimeout(resolve, 250));

      const log = await AuditLog.findOne({
        action: 'PII_READ',
        entityId: order._id.toString(),
        userId: staff._id,
      });

      expect(log).toBeDefined();
      expect(log?.entityType).toBe('Order');
    });

    it('resolves key from ENCRYPTION_KEY when FIELD_ENCRYPTION_KEYS is absent', () => {
      resetKeyRing();
      const rawHexKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const parsed = parseKeyRing(rawHexKey);
      expect(parsed.size).toBe(2);
      expect(parsed.get('1')?.toString('hex')).toBe(rawHexKey);
      expect(parsed.get('v1')?.toString('hex')).toBe(rawHexKey);
    });
  });
});
