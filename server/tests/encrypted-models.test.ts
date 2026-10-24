/// <reference types="jest" />
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { env } from '../src/config/env';
import User from '../src/models/User';
import Order from '../src/models/Order';
import Invoice from '../src/models/Invoice';
import Supplier from '../src/models/Supplier';
import ReturnRequest from '../src/models/ReturnRequest';
import { Category } from '../src/models/Category';
import { Product } from '../src/models/Product';
import { isEncrypted, decryptField } from '../src/utils/fieldCrypto';
import { migrateEncryptPersonalFields } from '../src/migrations/2026_encrypt_personal_fields';

function generateAuthToken(userId: Types.ObjectId, role = 'customer'): string {
  return jwt.sign(
    { sub: userId.toString(), role },
    env.JWT_SECRET || 'test-jwt-secret-key-12345678901234567890',
    { expiresIn: '1h' }
  );
}

describe('HIPAA02: Personal-Data Field Encryption & Model Integration (encrypted-models.test.ts)', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      const mongoUri = process.env.MONGO_URI || env.MONGO_URI || 'mongodb://localhost:27017/shop';
      await mongoose.connect(mongoUri);
    }
  });

  it('stores User address fields (line1, line2, phone) as AES-256-GCM ciphertext while API returns plaintext', async () => {
    const rand = Math.random().toString(36).slice(2, 8);
    const user = await User.create({
      name: `Encrypted User ${rand}`,
      email: `enc-user-${rand}@example.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
      role: 'customer',
      active: true,
      addresses: [
        {
          label: 'Home',
          line1: '123 Coconut Grove',
          line2: 'Apt 4B',
          city: 'Colombo',
          province: 'Western',
          postalCode: '00100',
          country: 'Sri Lanka',
          phone: '0771234567',
          isDefault: true,
        },
      ],
    });

    // 1. Raw MongoDB storage check
    const rawUser = await mongoose.connection.collection('users').findOne({ _id: user._id });
    expect(rawUser).toBeDefined();
    const rawAddr = rawUser?.addresses?.[0];
    expect(rawAddr).toBeDefined();

    // Verify ciphertext format
    expect(rawAddr.line1.startsWith('enc:v')).toBe(true);
    expect(isEncrypted(rawAddr.line1)).toBe(true);
    expect(rawAddr.line2.startsWith('enc:v')).toBe(true);
    expect(isEncrypted(rawAddr.line2)).toBe(true);
    expect(rawAddr.phone.startsWith('enc:v')).toBe(true);
    expect(isEncrypted(rawAddr.phone)).toBe(true);

    // Verify plaintext exclusions are NOT encrypted
    expect(rawUser?.email).toBe(`enc-user-${rand}@example.com`);
    expect(rawUser?.role).toBe('customer');
    expect(rawAddr.city).toBe('Colombo');
    expect(rawAddr.province).toBe('Western');
    expect(rawAddr.postalCode).toBe('00100');
    expect(rawAddr.country).toBe('Sri Lanka');

    // 2. Hydrated document API check
    const fetchedUser = await User.findById(user._id);
    expect(fetchedUser).toBeDefined();
    expect(fetchedUser?.addresses[0].line1).toBe('123 Coconut Grove');
    expect(fetchedUser?.addresses[0].line2).toBe('Apt 4B');
    expect(fetchedUser?.addresses[0].phone).toBe('0771234567');

    // 3. Authenticated API endpoint check (GET /api/auth/me)
    const token = generateAuthToken(user._id as Types.ObjectId);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const apiAddr = res.body.data.user.addresses[0];
    expect(apiAddr.line1).toBe('123 Coconut Grove');
    expect(apiAddr.line2).toBe('Apt 4B');
    expect(apiAddr.phone).toBe('0771234567');
  });

  it('supports saving an existing document twice without double encryption or validation failure', async () => {
    const rand = Math.random().toString(36).slice(2, 8);
    const user = await User.create({
      name: `Double Save User ${rand}`,
      email: `double-save-${rand}@example.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
      role: 'customer',
      active: true,
      addresses: [
        {
          label: 'Work',
          line1: '500 Tech Tower',
          city: 'Colombo',
          province: 'Western',
          postalCode: '00200',
          country: 'Sri Lanka',
          phone: '0112345678',
          isDefault: true,
        },
      ],
    });

    // Save 1: already occurred in create
    const rawAfterCreate = await mongoose.connection.collection('users').findOne({ _id: user._id });
    const firstCipher = rawAfterCreate?.addresses[0].line1;
    expect(isEncrypted(firstCipher)).toBe(true);

    // Save 2: call save() again immediately on the same hydrated document
    user.name = `Double Save Renamed ${rand}`;
    await user.save();

    // Verify raw collection has valid encryption (not double encrypted enc:v...enc:v...)
    const rawAfterSecondSave = await mongoose.connection.collection('users').findOne({ _id: user._id });
    const secondCipher = rawAfterSecondSave?.addresses[0].line1;
    expect(isEncrypted(secondCipher)).toBe(true);

    // Decrypting secondCipher returns the original plaintext
    const decrypted = decryptField(secondCipher, 'User.addresses.line1');
    expect(decrypted).toBe('500 Tech Tower');

    // In-memory document returns plaintext
    expect(user.addresses[0].line1).toBe('500 Tech Tower');
    expect(user.addresses[0].phone).toBe('0112345678');
  });

  it('snapshots shipping address from User into Order and Invoice with fresh IVs, maintaining plaintext in responses', async () => {
    const rand = Math.random().toString(36).slice(2, 8);
    const user = await User.create({
      name: `Checkout Customer ${rand}`,
      email: `checkout-${rand}@example.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
      role: 'customer',
      active: true,
      addresses: [
        {
          label: 'Delivery Spot',
          line1: '77 Ocean Drive',
          line2: 'Floor 3',
          city: 'Galle',
          province: 'Southern',
          postalCode: '80000',
          country: 'Sri Lanka',
          phone: '0912233445',
          isDefault: true,
        },
      ],
    });

    let category = await Category.findOne();
    if (!category) {
      category = await Category.create({
        name: `Enc Category ${rand}`,
        slug: `enc-cat-${rand}`,
        description: 'Category for encryption testing',
        image: 'https://example.com/cat.jpg',
        department: new Types.ObjectId(),
      });
    }

    const product = await Product.create({
      name: `Enc Apparel ${rand}`,
      slug: `enc-apparel-${rand}`,
      description: 'Apparel for encryption testing',
      category: category._id,
      images: ['https://example.com/img.jpg'],
      basePrice: 1200,
      status: 'active',
      variants: [
        {
          size: 'L',
          color: 'Black',
          material: 'Silk',
          sku: `SKU-ENC-${rand.toUpperCase()}`,
          stock: 10,
        },
      ],
    });

    const token = generateAuthToken(user._id as Types.ObjectId);
    const addressId = user.addresses[0]._id?.toString();

    // 1. Create Order via POST /api/orders
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        shippingAddressId: addressId,
        paymentMethod: 'simulated_online',
        items: [
          {
            productId: product._id.toString(),
            variantSku: product.variants[0].sku,
            quantity: 1,
          },
        ],
      });

    expect(orderRes.status).toBe(201);
    expect(orderRes.body.success).toBe(true);
    const orderId = orderRes.body.data.order._id;

    // Verify Order API response has plaintext shippingAddress
    expect(orderRes.body.data.order.shippingAddress.line1).toBe('77 Ocean Drive');
    expect(orderRes.body.data.order.shippingAddress.line2).toBe('Floor 3');

    // 2. Inspect raw Order in MongoDB
    const rawOrder = await mongoose.connection.collection('orders').findOne({ _id: new Types.ObjectId(orderId) });
    expect(rawOrder).toBeDefined();
    expect(isEncrypted(rawOrder?.shippingAddress.line1)).toBe(true);
    expect(isEncrypted(rawOrder?.shippingAddress.line2)).toBe(true);
    expect(rawOrder?.shippingAddress.city).toBe('Galle');

    // Confirm fresh IV / different ciphertext between User and Order
    const rawUser = await mongoose.connection.collection('users').findOne({ _id: user._id });
    expect(rawOrder?.shippingAddress.line1).not.toBe(rawUser?.addresses[0].line1);

    // 3. Confirm order to trigger Invoice generation via POST /api/orders/:id/payment/simulate
    const payRes = await request(app)
      .post(`/api/orders/${orderId}/payment/simulate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'tok_test_success' });

    expect(payRes.status).toBe(200);

    // 4. Retrieve Invoice via GET /api/invoices/:orderId
    const invoiceRes = await request(app)
      .get(`/api/invoices/${orderId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(invoiceRes.status).toBe(200);
    expect(invoiceRes.body.success).toBe(true);
    const invSnapshot = invoiceRes.body.data.snapshot;
    expect(invSnapshot.shippingAddress.line1).toBe('77 Ocean Drive');
    expect(invSnapshot.shippingAddress.line2).toBe('Floor 3');

    // 5. Inspect raw Invoice in MongoDB
    const rawInvoice = await mongoose.connection.collection('invoices').findOne({
      order: new Types.ObjectId(orderId),
    });
    expect(rawInvoice).toBeDefined();
    const rawInvAddr = rawInvoice?.snapshot?.shippingAddress;
    expect(isEncrypted(rawInvAddr.line1)).toBe(true);
    expect(isEncrypted(rawInvAddr.line2)).toBe(true);
    expect(rawInvAddr.city).toBe('Galle');

    // Confirm fresh IV / different ciphertext for Invoice
    expect(rawInvAddr.line1).not.toBe(rawOrder?.shippingAddress.line1);
    expect(rawInvAddr.line1).not.toBe(rawUser?.addresses[0].line1);

    // 6. Test PDF stream (GET /api/invoices/:orderId/pdf)
    const pdfRes = await request(app)
      .get(`/api/invoices/${orderId}/pdf`)
      .set('Authorization', `Bearer ${token}`);

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toBe('application/pdf');
    expect(pdfRes.body.length).toBeGreaterThan(100);
  });

  it('encrypts Supplier phone and address at rest while keeping text index on companyName and email active', async () => {
    const rand = Math.random().toString(36).slice(2, 8);
    const supplier = await Supplier.create({
      name: `Test Contact ${rand}`,
      companyName: `Fabric Mill ${rand} Industries`,
      email: `supplier-${rand}@mill.lk`,
      phone: '0119876543',
      address: 'Plot 88, Biyagama Export Processing Zone',
      status: 'active',
    });

    // Inspect raw Supplier document
    const rawSupplier = await mongoose.connection.collection('suppliers').findOne({ _id: supplier._id });
    expect(rawSupplier).toBeDefined();
    expect(isEncrypted(rawSupplier?.phone)).toBe(true);
    expect(isEncrypted(rawSupplier?.address)).toBe(true);

    // Confirm unencrypted plaintext fields
    expect(rawSupplier?.name).toBe(`Test Contact ${rand}`);
    expect(rawSupplier?.companyName).toBe(`Fabric Mill ${rand} Industries`);
    expect(rawSupplier?.email).toBe(`supplier-${rand}@mill.lk`);

    // Hydrated document returns plaintext
    const fetchedSupplier = await Supplier.findById(supplier._id);
    expect(fetchedSupplier?.phone).toBe('0119876543');
    expect(fetchedSupplier?.address).toBe('Plot 88, Biyagama Export Processing Zone');

    // Confirm text index search functions as expected on companyName
    const searchResult = await Supplier.findOne({
      $text: { $search: `Fabric Mill ${rand}` },
    });
    expect(searchResult).toBeDefined();
    expect(searchResult?._id.toString()).toBe(supplier._id.toString());
  });

  it('encrypts ReturnRequest pickup address at rest and decrypts on hydrated read', async () => {
    const rand = Math.random().toString(36).slice(2, 8);
    const user = await User.create({
      name: `Return Customer ${rand}`,
      email: `return-${rand}@example.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
      role: 'customer',
      active: true,
    });

    const returnReq = await ReturnRequest.create({
      order: new Types.ObjectId(),
      user: user._id,
      items: [
        {
          orderItemRef: 0,
          sku: `SKU-RET-${rand}`,
          qty: 1,
          reason: 'Size too large',
        },
      ],
      pickup: {
        courier: 'Pronto Delivery',
        waybill: `WB-${rand}`,
        address: '12 Temple Lane, Colombo 03',
      },
      status: 'pickup_scheduled',
    });

    // Inspect raw document in MongoDB
    const rawReturn = await mongoose.connection.collection('returnrequests').findOne({ _id: returnReq._id });
    expect(rawReturn).toBeDefined();
    expect(isEncrypted(rawReturn?.pickup?.address)).toBe(true);

    // Hydrated read returns plaintext
    const fetchedReturn = await ReturnRequest.findById(returnReq._id);
    expect(fetchedReturn?.pickup?.address).toBe('12 Temple Lane, Colombo 03');
  });

  it('runs migration dry-run without modifying data and applies encryption idempotently', async () => {
    const rand = Math.random().toString(36).slice(2, 8);
    const testUserId = new Types.ObjectId();

    // Direct insertion of unencrypted legacy document into raw collection
    await mongoose.connection.collection('users').insertOne({
      _id: testUserId,
      name: `Legacy User ${rand}`,
      email: `legacy-${rand}@example.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
      role: 'customer',
      active: true,
      addresses: [
        {
          label: 'Old Home',
          line1: '99 Old Moor Street',
          line2: 'Suite 1',
          city: 'Colombo',
          province: 'Western',
          postalCode: '01200',
          country: 'Sri Lanka',
          phone: '0711122233',
          isDefault: true,
        },
      ],
    });

    // 1. Dry run: should count wouldEncrypt > 0, but NOT write to database
    const dryRunStats = await migrateEncryptPersonalFields({ apply: false });
    expect(dryRunStats.users.wouldEncrypt).toBeGreaterThan(0);
    expect(dryRunStats.users.encrypted).toBe(0);

    // Check database still holds plaintext after dry-run
    const rawStillPlain = await mongoose.connection.collection('users').findOne({ _id: testUserId });
    expect(isEncrypted(rawStillPlain?.addresses[0].line1)).toBe(false);
    expect(rawStillPlain?.addresses[0].line1).toBe('99 Old Moor Street');

    // 2. Apply run: should encrypt and write to database
    const applyStats1 = await migrateEncryptPersonalFields({ apply: true });
    expect(applyStats1.users.encrypted).toBeGreaterThan(0);

    // Check database now holds ciphertext
    const rawNowEncrypted = await mongoose.connection.collection('users').findOne({ _id: testUserId });
    expect(isEncrypted(rawNowEncrypted?.addresses[0].line1)).toBe(true);
    expect(decryptField(rawNowEncrypted?.addresses[0].line1, 'User.addresses.line1')).toBe('99 Old Moor Street');

    // 3. Second apply run: must be idempotent (wouldEncrypt === 0 for this user, alreadyEncrypted counted)
    const applyStats2 = await migrateEncryptPersonalFields({ apply: true });
    expect(applyStats2.users.wouldEncrypt).toBe(0);
    expect(applyStats2.users.alreadyEncrypted).toBeGreaterThan(0);
  });
});
