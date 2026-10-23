/// <reference types="jest" />
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../app';
import { env } from '../config/env';
import User from '../models/User';
import Order, { IOrder } from '../models/Order';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import AuditLog from '../models/AuditLog';
import {
  generateFieldAccessMatrixMarkdown,
  FIELD_ACCESS_POLICIES,
} from '../config/field-access';
import {
  applyFieldPolicy,
  maskPhone,
  maskEmail,
  checkPiiRateLimit,
} from '../utils/fieldAccess';

function generateAuthToken(userId: Types.ObjectId, role = 'customer'): string {
  return jwt.sign(
    { sub: userId.toString(), role },
    env.JWT_SECRET || 'test-jwt-secret-key-12345678901234567890',
    { expiresIn: '1h' }
  );
}

async function createTestUser(role = 'customer', rand = Math.random().toString(36).slice(2, 8)) {
  return User.create({
    name: `FieldTest ${role} ${rand}`,
    email: `field-${role}-${rand}@example.com`,
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
    role,
    active: true,
    addresses: [
      {
        line1: '452 Galle Road',
        line2: 'Suite 9B',
        city: 'Colombo',
        province: 'Western',
        postalCode: '00300',
        country: 'Sri Lanka',
        phone: '0771234567',
        isDefault: true,
      },
    ],
  });
}

async function createTestOrder(userId: Types.ObjectId, rand: string, status = 'processing'): Promise<IOrder> {
  let category = await Category.findOne();
  if (!category) {
    category = await Category.create({
      name: `FieldCat ${rand}`,
      slug: `field-cat-${rand}`,
      description: `Field Category ${rand}`,
      image: 'https://example.com/cat.jpg',
      department: new Types.ObjectId(),
    });
  }

  const product = await Product.create({
    name: `FieldProduct ${rand}`,
    slug: `field-prod-${rand}`,
    description: `Field Product ${rand}`,
    category: category._id,
    images: ['https://example.com/item.jpg'],
    basePrice: 1200,
    status: 'active',
    variants: [
      {
        size: 'L',
        color: 'Black',
        material: 'Silk',
        sku: `SKU-FIELD-${rand.toUpperCase()}`,
        stock: 15,
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
        unitPrice: 1200,
        quantity: 1,
        lineTotal: 1200,
      },
    ],
    shippingAddress: {
      line1: '452 Galle Road',
      line2: 'Suite 9B',
      city: 'Colombo',
      province: 'Western',
      postalCode: '00300',
      country: 'Sri Lanka',
      phone: '0771234567',
    },
    discountAmount: 0,
    subtotal: 1200,
    shippingFee: 150,
    total: 1350,
    status,
    pointsPaid: 0,
  });
}

describe('HIPAA03: Role-Based Field Access Control & PII Read Auditing', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      const mongoUri = process.env.MONGO_URI || env.MONGO_URI || 'mongodb://localhost:27017/shop';
      await mongoose.connect(mongoUri);
    }
  });

  describe('Policy Drift Verification', () => {
    it('verifies docs/FIELD_ACCESS_MATRIX.md matches field-access.ts exactly', () => {
      const matrixDocPath = path.resolve(__dirname, '../../../docs/FIELD_ACCESS_MATRIX.md');
      expect(fs.existsSync(matrixDocPath)).toBe(true);

      const docContent = fs.readFileSync(matrixDocPath, 'utf8').trim().replace(/\r\n/g, '\n');
      const generatedContent = generateFieldAccessMatrixMarkdown().trim().replace(/\r\n/g, '\n');

      expect(docContent).toBe(generatedContent);
    });

    it('contains comprehensive policy definitions for all required domain entities', () => {
      const entities = Object.keys(FIELD_ACCESS_POLICIES);
      expect(entities).toContain('Order');
      expect(entities).toContain('Invoice');
      expect(entities).toContain('ReturnRequest');
      expect(entities).toContain('User');
      expect(entities).toContain('Supplier');
    });
  });

  describe('Unit Masking & Policy Engine', () => {
    it('masks phone numbers preserving only the trailing 3 digits', () => {
      expect(maskPhone('0771234567')).toBe('*******567');
      expect(maskPhone('+94 77 123 4567')).toBe('+** ** *** *567');
      expect(maskPhone('123')).toBe('***');
      expect(maskPhone('')).toBe('');
      expect(maskPhone(null)).toBe('');
    });

    it('masks email addresses for operational display', () => {
      expect(maskEmail('customer@example.com')).toBe('c***@example.com');
      expect(maskEmail('john.doe@company.org')).toBe('j***@company.org');
      expect(maskEmail('invalid')).toBe('***');
      expect(maskEmail('')).toBe('***');
      expect(maskEmail(null)).toBe('***');
    });

    it('never mutates the input source document', () => {
      const rawOrder = {
        status: 'processing',
        shippingAddress: {
          line1: '123 Main St',
          city: 'Colombo',
          phone: '0771234567',
        },
        user: {
          name: 'Jane Doe',
          email: 'jane@example.com',
        },
      };

      const cloned = JSON.parse(JSON.stringify(rawOrder));
      const staffResult = applyFieldPolicy('Order', rawOrder, 'staff', { isOwner: false });

      // Original remains pristine
      expect(rawOrder).toEqual(cloned);
      // Result has masked values
      expect(staffResult.shippingAddress.phone).toBe('*******567');
      expect(staffResult.user.email).toBe('j***@example.com');
    });
  });

  describe('Endpoint Field Access & Audit Logging (GET /api/orders/:orderId)', () => {
    it('customer (owner) receives full address, phone, and email with zero PII_READ audit logs', async () => {
      const rand = Math.random().toString(36).slice(2, 8);
      const customer = await createTestUser('customer', rand);
      const token = generateAuthToken(customer._id as Types.ObjectId, 'customer');
      const order = await createTestOrder(customer._id as Types.ObjectId, rand, 'processing');

      const initialPiiAudits = await AuditLog.countDocuments({
        action: 'PII_READ',
        entityId: order._id.toString(),
      });

      const res = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order.shippingAddress.line1).toBe('452 Galle Road');
      expect(res.body.data.order.shippingAddress.line2).toBe('Suite 9B');
      expect(res.body.data.order.shippingAddress.city).toBe('Colombo');
      expect(res.body.data.order.shippingAddress.phone).toBe('0771234567');

      // Zero PII_READ audits for owner self-access
      const finalPiiAudits = await AuditLog.countDocuments({
        action: 'PII_READ',
        entityId: order._id.toString(),
      });
      expect(finalPiiAudits).toBe(initialPiiAudits);
    });

    it('customer (non-owner) receives 403 Forbidden', async () => {
      const rand = Math.random().toString(36).slice(2, 8);
      const ownerCustomer = await createTestUser('customer', `own-${rand}`);
      const otherCustomer = await createTestUser('customer', `oth-${rand}`);
      const tokenOther = generateAuthToken(otherCustomer._id as Types.ObjectId, 'customer');
      const order = await createTestOrder(ownerCustomer._id as Types.ObjectId, rand, 'processing');

      const res = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${tokenOther}`);

      expect(res.status).toBe(403);
    });

    it('staff receives full address, masked phone, masked email, and triggers PII_READ audit with field names only', async () => {
      const rand = Math.random().toString(36).slice(2, 8);
      const customer = await createTestUser('customer', rand);
      const staff = await createTestUser('staff', rand);
      const tokenStaff = generateAuthToken(staff._id as Types.ObjectId, 'staff');
      const order = await createTestOrder(customer._id as Types.ObjectId, rand, 'processing');

      const res = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${tokenStaff}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const deliveredOrder = res.body.data.order;
      // Staff gets full address for packing/dispatch
      expect(deliveredOrder.shippingAddress.line1).toBe('452 Galle Road');
      expect(deliveredOrder.shippingAddress.line2).toBe('Suite 9B');
      expect(deliveredOrder.shippingAddress.city).toBe('Colombo');
      // Phone is masked (trailing 3 digits only)
      expect(deliveredOrder.shippingAddress.phone).toBe('*******567');
      // Customer email is masked
      expect(deliveredOrder.user.email).toMatch(/^[a-z]\*\*\*@/i);

      // Verify PII_READ audit record
      const auditLog = await AuditLog.findOne({
        action: 'PII_READ',
        entityId: order._id.toString(),
        role: 'staff',
      }).sort({ createdAt: -1 });

      expect(auditLog).toBeDefined();
      expect(auditLog?.action).toBe('PII_READ');
      expect(auditLog?.entityType).toBe('Order');
      expect((auditLog?.meta as any)?.viewerRole).toBe('staff');
      expect((auditLog?.meta as any)?.fields).toContain('shippingAddress.line1');

      // Critical Guarantee: Zero raw values inside audit log!
      const metaString = JSON.stringify(auditLog?.meta || {});
      expect(metaString).not.toContain('452 Galle Road');
      expect(metaString).not.toContain('0771234567');
      expect(metaString).not.toContain(customer.email);
    });

    it('delivery_manager receives city only in pre-dispatch state, and full address/phone in active transit', async () => {
      const rand = Math.random().toString(36).slice(2, 8);
      const customer = await createTestUser('customer', rand);
      const dm = await createTestUser('delivery_manager', rand);
      const tokenDm = generateAuthToken(dm._id as Types.ObjectId, 'delivery_manager');

      // State 1: processing (Pre-dispatch)
      const order = await createTestOrder(customer._id as Types.ObjectId, rand, 'processing');

      const resPre = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${tokenDm}`);

      expect(resPre.status).toBe(200);
      const preOrder = resPre.body.data.order;
      expect(preOrder.shippingAddress.city).toBe('Colombo');
      expect(preOrder.shippingAddress.postalCode).toBe('00300');
      // Pre-dispatch: street line1, line2, and phone are hidden
      expect(preOrder.shippingAddress.line1).toBeUndefined();
      expect(preOrder.shippingAddress.line2).toBeUndefined();
      expect(preOrder.shippingAddress.phone).toBeUndefined();
      // Email is not exposed to delivery personnel
      expect(preOrder.user.email).toBeUndefined();

      // State 2: Transition to in_transit (Active delivery)
      order.status = 'in_transit';
      await order.save();

      const resTransit = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${tokenDm}`);

      expect(resTransit.status).toBe(200);
      const transitOrder = resTransit.body.data.order;
      // Active transit: full address and phone granted for fulfillment
      expect(transitOrder.shippingAddress.line1).toBe('452 Galle Road');
      expect(transitOrder.shippingAddress.line2).toBe('Suite 9B');
      expect(transitOrder.shippingAddress.phone).toBe('0771234567');

      // PII_READ audit record created for active transit read
      const transitAudit = await AuditLog.findOne({
        action: 'PII_READ',
        entityId: order._id.toString(),
        role: 'delivery_manager',
      }).sort({ createdAt: -1 });

      expect(transitAudit).toBeDefined();
      expect((transitAudit?.meta as any)?.fields).toContain('shippingAddress.line1');
      expect((transitAudit?.meta as any)?.fields).toContain('shippingAddress.phone');
      expect(JSON.stringify(transitAudit?.meta || {})).not.toContain('452 Galle Road');
    });

    it('admin receives full order details and records PII_READ audit log', async () => {
      const rand = Math.random().toString(36).slice(2, 8);
      const customer = await createTestUser('customer', rand);
      const admin = await createTestUser('admin', rand);
      const tokenAdmin = generateAuthToken(admin._id as Types.ObjectId, 'admin');
      const order = await createTestOrder(customer._id as Types.ObjectId, rand, 'processing');

      const res = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.data.order.shippingAddress.line1).toBe('452 Galle Road');
      expect(res.body.data.order.shippingAddress.phone).toBe('0771234567');
      expect(res.body.data.order.user.email).toBe(customer.email);

      const adminAudit = await AuditLog.findOne({
        action: 'PII_READ',
        entityId: order._id.toString(),
        role: 'admin',
      }).sort({ createdAt: -1 });

      expect(adminAudit).toBeDefined();
      expect((adminAudit?.meta as any)?.fields).toContain('shippingAddress.line1');
      expect((adminAudit?.meta as any)?.fields).toContain('shippingAddress.phone');
      expect(JSON.stringify(adminAudit?.meta || {})).not.toContain('452 Galle Road');
    });

    it('supplier receives 403 Forbidden attempting to access customer orders', async () => {
      const rand = Math.random().toString(36).slice(2, 8);
      const customer = await createTestUser('customer', rand);
      const supplierUser = await createTestUser('supplier', rand);
      const tokenSupplier = generateAuthToken(supplierUser._id as Types.ObjectId, 'supplier');
      const order = await createTestOrder(customer._id as Types.ObjectId, rand, 'processing');

      const res = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${tokenSupplier}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Rate Limiting on Sensitive List Endpoints', () => {
    it('exempts owner role from PII list rate limits', async () => {
      const ownerReq: any = { user: { role: 'owner', _id: new Types.ObjectId() } };
      const res: any = { headersSent: false };

      const permitted = await checkPiiRateLimit(ownerReq, res);
      expect(permitted).toBe(true);
    });
  });
});
