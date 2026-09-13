import http from 'http';
import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { User, IUser } from './src/models/User';
import { Order, IOrder, OrderStatus } from './src/models/Order';
import { Product } from './src/models/Product';
import { canTransition } from './src/config/order-transitions';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_1234567890_super_secret';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shop';

function makeAuthCookie(userId: string): string {
  const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
  return `slt=${token}`;
}

function jsonRequest(
  method: string,
  path: string,
  body?: any,
  cookie?: string
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload).toString(),
    };
    if (cookie) headers['Cookie'] = cookie;

    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode || 500, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${testName}`);
    passed++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${testName}${detail ? ` -> ${detail}` : ''}`);
    failed++;
  }
}

async function run() {
  console.log('\n========================================');
  console.log('  P50 Delivery Manager Test Suite       ');
  console.log('========================================\n');

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB at', MONGODB_URI);

  // 1. Setup / identify test users
  const deliveryUser = await User.findOneAndUpdate(
    { email: 'p50_delivery@test.com' },
    {
      name: 'P50 Delivery Manager',
      email: 'p50_delivery@test.com',
      passwordHash: 'dummy',
      role: 'delivery_manager',
      active: true,
    },
    { upsert: true, new: true }
  );

  const customerUser = await User.findOneAndUpdate(
    { email: 'p50_customer@test.com' },
    {
      name: 'P50 Customer',
      email: 'p50_customer@test.com',
      passwordHash: 'dummy',
      role: 'customer',
      active: true,
    },
    { upsert: true, new: true }
  );

  const adminUser = await User.findOneAndUpdate(
    { email: 'p50_admin@test.com' },
    {
      name: 'P50 Admin',
      email: 'p50_admin@test.com',
      passwordHash: 'dummy',
      role: 'admin',
      active: true,
    },
    { upsert: true, new: true }
  );

  const deliveryCookie = makeAuthCookie(deliveryUser._id.toString());
  const customerCookie = makeAuthCookie(customerUser._id.toString());
  const adminCookie = makeAuthCookie(adminUser._id.toString());

  // Setup test product
  const product = await Product.findOneAndUpdate(
    { slug: 'p50-test-apparel' },
    {
      name: 'P50 Test Courier Apparel',
      slug: 'p50-test-apparel',
      description: 'P50 test item',
      basePrice: 3500,
      status: 'active',
      variants: [
        {
          sku: 'P50-SKU-01',
          size: 'L',
          color: 'Black',
          stock: 100,
          price: 3500,
        },
      ],
    },
    { upsert: true, new: true }
  );

  const testOrdersCreated: Types.ObjectId[] = [];

  async function createTestOrder(status: OrderStatus, trackingNumber?: string | null): Promise<IOrder> {
    const order = await Order.create({
      user: customerUser._id,
      items: [
        {
          product: product._id,
          variantSku: 'P50-SKU-01',
          name: product.name,
          image: '/uploads/test.jpg',
          size: 'L',
          color: 'Black',
          unitPrice: 3500,
          quantity: 2,
        },
      ],
      subtotal: 7000,
      shippingFee: 350,
      discountTotal: 500,
      total: 6850,
      pointsPaid: 0,
      status,
      trackingNumber: trackingNumber || null,
      shippingAddress: {
        line1: '456 Dispatch Road',
        city: 'Kandy',
        province: 'Central',
        postalCode: '20000',
        country: 'Sri Lanka',
      },
    });

    testOrdersCreated.push(order._id);
    return order;
  }

  try {
    // -------------------------------------------------------------------------
    // TEST SUITE 1: RBAC & Route Access Control
    // -------------------------------------------------------------------------
    console.log('\n--- Test Suite 1: RBAC & Scoped Access ---');
    const res1a = await jsonRequest('GET', '/api/delivery/orders', undefined, customerCookie);
    assert(res1a.status === 403, 'Test 1.1 Customer calling GET /api/delivery/orders returns 403', `Got: ${res1a.status}`);

    const res1b = await jsonRequest('PATCH', '/api/orders/507f1f77bcf86cd799439011/tracking', { trackingNumber: 'TRK-123' }, customerCookie);
    assert(res1b.status === 403, 'Test 1.2 Customer calling PATCH /api/orders/:id/tracking returns 403', `Got: ${res1b.status}`);

    const res1c = await jsonRequest('GET', '/api/admin/orders', undefined, deliveryCookie);
    assert(res1c.status === 403, 'Test 1.3 Delivery manager calling GET /api/admin/orders returns 403', `Got: ${res1c.status}`);

    const res1d = await jsonRequest('GET', '/api/delivery/orders', undefined, deliveryCookie);
    assert(res1d.status === 200, 'Test 1.4 Delivery manager calling GET /api/delivery/orders returns 200', `Got: ${res1d.status}`);

    const res1e = await jsonRequest('GET', '/api/delivery/orders', undefined, adminCookie);
    assert(res1e.status === 200, 'Test 1.5 Admin calling GET /api/delivery/orders returns 200', `Got: ${res1e.status}`);

    // -------------------------------------------------------------------------
    // TEST SUITE 2: Queue Scoping & Status Filtering
    // -------------------------------------------------------------------------
    console.log('\n--- Test Suite 2: Queue Scope & Status Filtering ---');
    const oPending = await createTestOrder('pending_payment');
    const oReview = await createTestOrder('payment_review');
    const oProcessing = await createTestOrder('processing');
    const oReady = await createTestOrder('ready_for_dispatch');
    const oTransit = await createTestOrder('in_transit');
    const oOutForDeliv = await createTestOrder('out_for_delivery');
    const oDelivered = await createTestOrder('delivered');
    const oCancelled = await createTestOrder('cancelled');

    const res2a = await jsonRequest('GET', '/api/delivery/orders', undefined, deliveryCookie);
    assert(res2a.status === 200, 'Test 2.1 Default queue returns 200');
    const queueOrderIds = (res2a.body?.data?.orders || []).map((o: any) => o._id.toString());

    assert(!queueOrderIds.includes(oPending._id.toString()), 'Test 2.2 Pending payment orders never in delivery queue');
    assert(!queueOrderIds.includes(oReview._id.toString()), 'Test 2.3 Payment review orders never in delivery queue');
    assert(!queueOrderIds.includes(oCancelled._id.toString()), 'Test 2.4 Cancelled orders never in delivery queue');

    assert(queueOrderIds.includes(oProcessing._id.toString()), 'Test 2.5 Processing orders included in fulfillment queue');
    assert(queueOrderIds.includes(oReady._id.toString()), 'Test 2.6 Ready for dispatch orders included in queue');
    assert(queueOrderIds.includes(oTransit._id.toString()), 'Test 2.7 In transit orders included in queue');
    assert(queueOrderIds.includes(oOutForDeliv._id.toString()), 'Test 2.8 Out for delivery orders included in queue');

    // Filter by status=ready_for_dispatch
    const res2b = await jsonRequest('GET', '/api/delivery/orders?status=ready_for_dispatch', undefined, deliveryCookie);
    assert(res2b.status === 200, 'Test 2.9 Filter ready_for_dispatch returns 200');
    const readyOnly = res2b.body?.data?.orders || [];
    assert(readyOnly.length > 0 && readyOnly.every((o: any) => o.status === 'ready_for_dispatch'), 'Test 2.10 All orders match filtered status');

    // Filter by status=delivered
    const res2c = await jsonRequest('GET', '/api/delivery/orders?status=delivered', undefined, deliveryCookie);
    assert(res2c.status === 200, 'Test 2.11 Filter delivered returns 200');
    const deliveredOnly = res2c.body?.data?.orders || [];
    assert(deliveredOnly.some((o: any) => o._id.toString() === oDelivered._id.toString()), 'Test 2.12 Delivered orders accessible via filter');

    // Filter by illegal status=pending_payment should return 0 results
    const res2d = await jsonRequest('GET', '/api/delivery/orders?status=pending_payment', undefined, deliveryCookie);
    assert(res2d.status === 200, 'Test 2.13 Filter non-fulfillment status returns 200');
    assert((res2d.body?.data?.orders || []).length === 0, 'Test 2.14 Non-fulfillment status filter strictly returns empty array');

    // -------------------------------------------------------------------------
    // TEST SUITE 3: Data Sanitization for Delivery Manager
    // -------------------------------------------------------------------------
    console.log('\n--- Test Suite 3: Data Sanitization ---');
    const sampleOrder = res2a.body?.data?.orders?.find((o: any) => o._id.toString() === oProcessing._id.toString());
    assert(sampleOrder != null, 'Test 3.1 Sample order retrieved from delivery queue');
    assert(sampleOrder?.total === undefined, 'Test 3.2 Delivery manager view omits order total');
    assert(sampleOrder?.subtotal === undefined, 'Test 3.3 Delivery manager view omits order subtotal');
    assert(sampleOrder?.discountTotal === undefined, 'Test 3.4 Delivery manager view omits order discountTotal');
    assert(sampleOrder?.shippingAddress?.line1 === '456 Dispatch Road', 'Test 3.5 Delivery manager view retains shipping address');
    assert(sampleOrder?.items?.length === 1 && sampleOrder?.items[0]?.variantSku === 'P50-SKU-01', 'Test 3.6 Delivery manager view retains item manifest');

    // -------------------------------------------------------------------------
    // TEST SUITE 4: Tracking Number Endpoint (PATCH /api/orders/:id/tracking)
    // -------------------------------------------------------------------------
    console.log('\n--- Test Suite 4: Tracking Number Endpoint ---');
    const res4a = await jsonRequest(
      'PATCH',
      `/api/orders/${oReady._id}/tracking`,
      { trackingNumber: 'TRK-LK-99887766' },
      deliveryCookie
    );
    assert(res4a.status === 200, 'Test 4.1 Update tracking returns 200', `Got: ${res4a.status}`);
    assert(res4a.body?.data?.order?.trackingNumber === 'TRK-LK-99887766', 'Test 4.2 Updated tracking number returned in response');

    // Verify in MongoDB
    const dbOrder4 = await Order.findById(oReady._id);
    assert(dbOrder4?.trackingNumber === 'TRK-LK-99887766', 'Test 4.3 Tracking number persisted in MongoDB');

    // Validation: empty tracking number
    const res4b = await jsonRequest(
      'PATCH',
      `/api/orders/${oReady._id}/tracking`,
      { trackingNumber: '   ' },
      deliveryCookie
    );
    assert(res4b.status === 422, 'Test 4.4 Empty tracking number rejected with 422', `Got: ${res4b.status}`);

    // Non-existent order -> 404
    const res4c = await jsonRequest(
      'PATCH',
      '/api/orders/507f1f77bcf86cd799439011/tracking',
      { trackingNumber: 'TRK-VALID' },
      deliveryCookie
    );
    assert(res4c.status === 404, 'Test 4.5 Non-existent order returns 404', `Got: ${res4c.status}`);

    // Convenience alias route /api/delivery/orders/:id/tracking
    const res4d = await jsonRequest(
      'PATCH',
      `/api/delivery/orders/${oReady._id}/tracking`,
      { trackingNumber: 'TRK-ALIAS-1122' },
      deliveryCookie
    );
    assert(res4d.status === 200, 'Test 4.6 Direct delivery alias route /api/delivery/orders/:id/tracking works with 200');

    // -------------------------------------------------------------------------
    // TEST SUITE 5: Delivery Lifecycle Progression & deliveredAt Timestamp
    // -------------------------------------------------------------------------
    console.log('\n--- Test Suite 5: Delivery State Advancement & deliveredAt ---');
    const oLifecycle = await createTestOrder('ready_for_dispatch');

    // 5.1 Advance: ready_for_dispatch -> picked_up
    const res5a = await jsonRequest('PATCH', `/api/orders/${oLifecycle._id}/status`, { status: 'picked_up' }, deliveryCookie);
    assert(res5a.status === 200, 'Test 5.1 Advance ready_for_dispatch -> picked_up returns 200');
    assert(res5a.body?.data?.order?.status === 'picked_up', 'Test 5.2 Order status updated to picked_up');

    // 5.2 Advance: picked_up -> in_transit
    const res5b = await jsonRequest('PATCH', `/api/orders/${oLifecycle._id}/status`, { status: 'in_transit' }, deliveryCookie);
    assert(res5b.status === 200, 'Test 5.3 Advance picked_up -> in_transit returns 200');
    assert(res5b.body?.data?.order?.status === 'in_transit', 'Test 5.4 Order status updated to in_transit');

    // 5.3 Advance: in_transit -> out_for_delivery
    const res5c = await jsonRequest('PATCH', `/api/orders/${oLifecycle._id}/status`, { status: 'out_for_delivery' }, deliveryCookie);
    assert(res5c.status === 200, 'Test 5.5 Advance in_transit -> out_for_delivery returns 200');
    assert(res5c.body?.data?.order?.status === 'out_for_delivery', 'Test 5.6 Order status updated to out_for_delivery');

    // 5.4 Advance: out_for_delivery -> delivered
    const beforeDeliver = Date.now();
    const res5d = await jsonRequest('PATCH', `/api/orders/${oLifecycle._id}/status`, { status: 'delivered' }, deliveryCookie);
    assert(res5d.status === 200, 'Test 5.7 Advance out_for_delivery -> delivered returns 200');
    assert(res5d.body?.data?.order?.status === 'delivered', 'Test 5.8 Order status updated to delivered');

    // 5.5 Verify deliveredAt is stamped automatically
    const dbOrder5 = await Order.findById(oLifecycle._id);
    assert(dbOrder5?.deliveredAt != null, 'Test 5.9 Order.deliveredAt is stamped upon delivered transition');
    const deliveredTime = dbOrder5?.deliveredAt ? new Date(dbOrder5.deliveredAt).getTime() : 0;
    assert(deliveredTime >= beforeDeliver - 5000, 'Test 5.10 deliveredAt timestamp is within execution window');

    // 5.6 Advance: processing -> ready_for_dispatch (warehouse packing by delivery_manager)
    const oProc = await createTestOrder('processing');
    const res5e = await jsonRequest('PATCH', `/api/orders/${oProc._id}/status`, { status: 'ready_for_dispatch' }, deliveryCookie);
    assert(res5e.status === 200, 'Test 5.11 Delivery manager can transition processing -> ready_for_dispatch');
    assert(res5e.body?.data?.order?.status === 'ready_for_dispatch', 'Test 5.12 Order moved to ready_for_dispatch');

    // 5.7 Illegal transition: delivered -> processing returns 400
    const res5f = await jsonRequest('PATCH', `/api/orders/${oLifecycle._id}/status`, { status: 'processing' }, deliveryCookie);
    assert(res5f.status === 400, 'Test 5.13 Delivery manager cannot illegally transition delivered -> processing');

  } finally {
    // Cleanup fixtures
    console.log('\nCleaning up test fixtures...');
    if (testOrdersCreated.length > 0) {
      await Order.deleteMany({ _id: { $in: testOrdersCreated } });
    }
    await mongoose.disconnect();
  }

  console.log('\n========================================');
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal error in verify_p50:', err);
  process.exit(1);
});
