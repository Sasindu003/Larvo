import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { User } from './src/models/User';
import { Order, OrderStatus } from './src/models/Order';
import { Product } from './src/models/Product';
import { Payment } from './src/models/Payment';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_1234567890_super_secret';

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

async function run() {
  console.log('====================================================');
  console.log('  RUNNING P47 ORDER HISTORY & TRACKING TEST SUITE   ');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/shop';
  await mongoose.connect(mongoUri);
  console.log('✔ Connected directly to MongoDB for fixtures and assertions.\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✔ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✖ FAIL: ${msg}`);
      failed++;
    }
  }

  try {
    // 1. Setup Test Users
    const custA = await User.findOneAndUpdate(
      { email: 'p47_custA@demo.com' },
      {
        $set: {
          name: 'P47 Customer Alpha',
          role: 'customer',
          status: 'active',
          passwordHash: '$2a$10$abcdefghijklmnopqrstuu',
        },
      },
      { upsert: true, new: true }
    );

    const custB = await User.findOneAndUpdate(
      { email: 'p47_custB@demo.com' },
      {
        $set: {
          name: 'P47 Customer Beta',
          role: 'customer',
          status: 'active',
          passwordHash: '$2a$10$abcdefghijklmnopqrstuu',
        },
      },
      { upsert: true, new: true }
    );

    const deliveryMgr = await User.findOneAndUpdate(
      { email: 'p47_delivery@demo.com' },
      {
        $set: {
          name: 'P47 Delivery Manager',
          role: 'delivery_manager',
          status: 'active',
          passwordHash: '$2a$10$abcdefghijklmnopqrstuu',
        },
      },
      { upsert: true, new: true }
    );

    const staffUser = await User.findOneAndUpdate(
      { email: 'p47_staff@demo.com' },
      {
        $set: {
          name: 'P47 Staff Member',
          role: 'staff',
          status: 'active',
          passwordHash: '$2a$10$abcdefghijklmnopqrstuu',
        },
      },
      { upsert: true, new: true }
    );

    const cookieA = makeAuthCookie(custA._id.toString());
    const cookieB = makeAuthCookie(custB._id.toString());
    const cookieDelivery = makeAuthCookie(deliveryMgr._id.toString());
    const cookieStaff = makeAuthCookie(staffUser._id.toString());

    // 2. Setup Test Product
    const testProd = await Product.findOneAndUpdate(
      { slug: 'p47-track-jacket' },
      {
        $set: {
          name: 'P47 Tracking Jacket',
          slug: 'p47-track-jacket',
          basePrice: 2800,
          status: 'active',
          images: ['/uploads/products/jacket.jpg'],
          variants: [
            {
              sku: 'SKU-P47-TRK-M',
              size: 'M',
              color: 'Navy',
              stock: 25,
            },
          ],
        },
      },
      { upsert: true, new: true }
    );

    // Clean previous test orders for isolation
    await Order.deleteMany({ user: { $in: [custA._id, custB._id] } });

    async function createOrder(userObjId: mongoose.Types.ObjectId, overrides: Partial<any> = {}) {
      return await Order.create({
        user: userObjId,
        items: [
          {
            product: testProd._id,
            variantSku: 'SKU-P47-TRK-M',
            name: testProd.name,
            image: testProd.images[0],
            size: 'M',
            color: 'Navy',
            unitPrice: 2800,
            quantity: 1,
          },
        ],
        shippingAddress: {
          label: 'Home',
          line1: '789 Shipping Way',
          city: 'Dhaka',
          province: 'Dhaka',
          postalCode: '1212',
          country: 'Bangladesh',
        },
        subtotal: 2800,
        shippingFee: 0,
        discountAmount: overrides.discountAmount ?? 0,
        couponCode: overrides.couponCode ?? null,
        total: overrides.total ?? 2800,
        status: overrides.status ?? 'pending_payment',
        pointsPaid: overrides.pointsPaid ?? 0,
        trackingNumber: overrides.trackingNumber ?? null,
        deliveredAt: overrides.deliveredAt ?? null,
      });
    }

    console.log('--- Test 1: GET /api/orders/me (paginated, customer-scoped, newest-first) ---');
    // Create 3 orders for Customer A at distinct times
    const orderA1 = await createOrder(custA._id, { total: 2800 });
    const orderA2 = await createOrder(custA._id, { total: 2800, pointsPaid: 2800 }); // Paid with points
    const orderA3 = await createOrder(custA._id, { total: 2800, trackingNumber: 'TRK-P47-998877' });
    // Create 1 order for Customer B
    const orderB1 = await createOrder(custB._id, { total: 1500 });

    const meRes = await jsonRequest('GET', '/api/orders/me?page=1&limit=2', undefined, cookieA);
    assert(meRes.status === 200, `GET /api/orders/me returns 200 (got ${meRes.status})`);
    assert(meRes.body.success === true, 'Response body success is true');
    assert(Array.isArray(meRes.body.data?.orders), 'Data contains orders array');
    assert(meRes.body.data?.orders.length === 2, `Page limit respected: returned 2 items (got ${meRes.body.data?.orders.length})`);
    assert(meRes.body.data?.total === 3, `Total orders for Customer A is 3 (got ${meRes.body.data?.total})`);
    assert(meRes.body.data?.pages === 2, `Total pages is 2 (got ${meRes.body.data?.pages})`);

    // Verify Customer A cannot see Customer B's order in /me
    const allOrdersA = (await jsonRequest('GET', '/api/orders/me?page=1&limit=10', undefined, cookieA)).body.data?.orders;
    const containsB = allOrdersA.some((o: any) => o._id === orderB1._id.toString());
    assert(!containsB, "Customer A's /me does not include Customer B's orders");

    // Verify newest first ordering
    const idOrder = allOrdersA.map((o: any) => o._id.toString());
    assert(
      idOrder[0] === orderA3._id.toString() && idOrder[2] === orderA1._id.toString(),
      'Orders are sorted newest-first (createdAt: -1)'
    );

    console.log('\n--- Test 2: GET /api/orders/:orderId (Ownership & Delivery Manager Sanitization) ---');
    // Customer A fetching own order -> 200
    const ownRes = await jsonRequest('GET', `/api/orders/${orderA1._id}`, undefined, cookieA);
    assert(ownRes.status === 200, `Customer A fetching own order returns 200 (got ${ownRes.status})`);
    assert(ownRes.body.data?.order?.total === 2800, 'Customer A receives full pricing data on own order');

    // Customer B fetching Customer A's order -> 403 Forbidden
    const crossRes = await jsonRequest('GET', `/api/orders/${orderA1._id}`, undefined, cookieB);
    assert(
      crossRes.status === 403,
      `Customer B fetching Customer A's order returns 403 Forbidden (got ${crossRes.status})`
    );

    // Nonexistent order ID -> 404
    const fakeId = new mongoose.Types.ObjectId();
    const notFoundRes = await jsonRequest('GET', `/api/orders/${fakeId}`, undefined, cookieA);
    assert(notFoundRes.status === 404, `Fetching nonexistent order returns 404 (got ${notFoundRes.status})`);

    // Delivery Manager fetching Customer A's order -> 200 with fulfillment-only projection
    const delivRes = await jsonRequest('GET', `/api/orders/${orderA3._id}`, undefined, cookieDelivery);
    assert(delivRes.status === 200, `Delivery manager fetching order returns 200 (got ${delivRes.status})`);
    const delivData = delivRes.body.data?.order;
    assert(!!delivData?.shippingAddress?.line1, 'Delivery manager sees shipping destination');
    assert(Array.isArray(delivData?.items) && delivData.items.length > 0, 'Delivery manager sees item manifest');
    assert(delivData?.trackingNumber === 'TRK-P47-998877', 'Delivery manager sees tracking number');
    assert(delivData?.total === undefined, 'Delivery manager projection OMITS order total');
    assert(delivData?.subtotal === undefined, 'Delivery manager projection OMITS subtotal');
    assert(delivData?.discountAmount === undefined, 'Delivery manager projection OMITS discount');
    assert(delivData?.pointsPaid === undefined, 'Delivery manager projection OMITS pointsPaid');

    // Staff user fetching order -> 200 with full financial details
    const staffRes = await jsonRequest('GET', `/api/orders/${orderA1._id}`, undefined, cookieStaff);
    assert(staffRes.status === 200, `Staff member fetching order returns 200 (got ${staffRes.status})`);
    assert(staffRes.body.data?.order?.total === 2800, 'Staff member sees full order financials');

    console.log('\n--- Test 3: PATCH /api/orders/:orderId/cancel (Customer self-cancellation & restock) ---');
    // Stock before cancel
    const prodBefore = await Product.findById(testProd._id);
    const stockBefore = prodBefore?.variants[0].stock ?? 0;

    // Customer B tries to cancel Customer A's order -> 403 Forbidden
    const cancelHackRes = await jsonRequest('PATCH', `/api/orders/${orderA1._id}/cancel`, undefined, cookieB);
    assert(
      cancelHackRes.status === 403,
      `Customer B attempting to cancel Customer A's order returns 403 (got ${cancelHackRes.status})`
    );

    // Customer A cancels own pending order -> 200 OK
    const cancelRes = await jsonRequest('PATCH', `/api/orders/${orderA1._id}/cancel`, undefined, cookieA);
    assert(
      cancelRes.status === 200 && cancelRes.body.data?.order?.status === 'cancelled',
      `Customer A cancels own pending order -> 200 OK (status: ${cancelRes.body.data?.order?.status})`
    );

    // Verify stock restocked (+1)
    const prodAfter = await Product.findById(testProd._id);
    const stockAfter = prodAfter?.variants[0].stock ?? 0;
    assert(stockAfter === stockBefore + 1, `Inventory atomically restocked: was ${stockBefore}, now ${stockAfter}`);

    // Plain customer cannot cancel confirmed order -> 400/403
    const confirmedOrder = await createOrder(custA._id, { status: 'confirmed' });
    const cancelConfirmedRes = await jsonRequest('PATCH', `/api/orders/${confirmedOrder._id}/cancel`, undefined, cookieA);
    assert(
      cancelConfirmedRes.status === 400 || cancelConfirmedRes.status === 403,
      `Customer cannot cancel confirmed order (got ${cancelConfirmedRes.status} as expected)`
    );

    console.log('\n--- Test 4: Reward Point Payment Indicators ---');
    const rewardOrderRes = await jsonRequest('GET', `/api/orders/${orderA2._id}`, undefined, cookieA);
    assert(rewardOrderRes.status === 200, `GET /orders/:id for points-paid order returns 200`);
    assert(
      rewardOrderRes.body.data?.order?.pointsPaid === 2800,
      `Order clearly indicates pointsPaid: ${rewardOrderRes.body.data?.order?.pointsPaid} pts`
    );

  } catch (error) {
    console.error('Test execution error:', error);
    failed++;
  } finally {
    await mongoose.disconnect();
    console.log('\n====================================================');
    console.log(`P47 TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');
    if (failed > 0) {
      process.exit(1);
    }
  }
}

run();
