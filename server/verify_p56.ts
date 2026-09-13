import http from 'http';
import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import app from './src/app';
import { User } from './src/models/User';
import { Order } from './src/models/Order';
import { ReturnRequest } from './src/models/ReturnRequest';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_1234567890_super_secret';
const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shop';

function makeAuthCookie(userId: string): string {
  const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
  return `slt=${token}`;
}

let server: http.Server;
let serverPort: number;

function jsonRequest(
  method: string,
  path: string,
  body?: any,
  cookie?: string
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : undefined;
    const headers: Record<string, string> = {};
    if (cookie) headers['Cookie'] = cookie;
    if (postData) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData).toString();
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: serverPort,
        path,
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (raw += chunk));
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
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING P56 VERIFICATION SUITE ===\n');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  await new Promise<void>((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        serverPort = addr.port;
      }
      console.log(`Ephemeral test server listening on port ${serverPort}\n`);
      resolve();
    });
  });

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ [PASS] ${testName}`);
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    }
  }

  try {
    // 1. Setup Test Users
    const cust1 = await User.findOneAndUpdate(
      { email: 'p56_customer1@larvo.com' },
      {
        name: 'P56 Customer 1',
        password: '$2a$10$hashedpasswordplaceholder123456',
        role: 'customer',
        active: true,
      },
      { upsert: true, new: true }
    );

    const cust2 = await User.findOneAndUpdate(
      { email: 'p56_customer2@larvo.com' },
      {
        name: 'P56 Customer 2',
        password: '$2a$10$hashedpasswordplaceholder123456',
        role: 'customer',
        active: true,
      },
      { upsert: true, new: true }
    );

    const staffUser = await User.findOneAndUpdate(
      { email: 'p56_staff@larvo.com' },
      {
        name: 'P56 Staff',
        password: '$2a$10$hashedpasswordplaceholder123456',
        role: 'staff',
        active: true,
      },
      { upsert: true, new: true }
    );

    const cookieCust1 = makeAuthCookie(cust1._id.toString());
    const cookieCust2 = makeAuthCookie(cust2._id.toString());
    const cookieStaff = makeAuthCookie(staffUser._id.toString());

    // 2. Setup Test Orders
    const dummyProductId = new Types.ObjectId();
    const address = {
      line1: '123 Test St',
      city: 'Testville',
      province: 'Western',
      postalCode: '12345',
      country: 'LK',
    };

    // Eligible delivered order (delivered 2 days ago)
    const eligibleDeliveredAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const eligibleOrder = await Order.create({
      user: cust1._id,
      items: [
        {
          product: dummyProductId,
          name: 'Classic Linen Shirt',
          image: '/uploads/shirt.jpg',
          variantSku: 'LINEN-SHIRT-M',
          size: 'M',
          color: 'Navy',
          unitPrice: 45,
          quantity: 2,
        },
        {
          product: dummyProductId,
          name: 'Chino Trousers',
          image: '/uploads/chino.jpg',
          variantSku: 'CHINO-32',
          size: '32',
          color: 'Beige',
          unitPrice: 60,
          quantity: 1,
        },
      ],
      shippingAddress: address,
      discountAmount: 0,
      subtotal: 150,
      shippingFee: 0,
      total: 150,
      status: 'delivered',
      deliveredAt: eligibleDeliveredAt,
    });

    // Expired delivered order (delivered 10 days ago)
    const expiredDeliveredAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const expiredOrder = await Order.create({
      user: cust1._id,
      items: [
        {
          product: dummyProductId,
          name: 'Expired Item',
          image: '/uploads/item.jpg',
          variantSku: 'EXP-01',
          size: 'L',
          color: 'Black',
          unitPrice: 50,
          quantity: 1,
        },
      ],
      shippingAddress: address,
      discountAmount: 0,
      subtotal: 50,
      shippingFee: 0,
      total: 50,
      status: 'delivered',
      deliveredAt: expiredDeliveredAt,
    });

    // Not delivered order (processing)
    const processingOrder = await Order.create({
      user: cust1._id,
      items: [
        {
          product: dummyProductId,
          name: 'Processing Item',
          image: '/uploads/item.jpg',
          variantSku: 'PROC-01',
          size: 'L',
          color: 'Blue',
          unitPrice: 50,
          quantity: 1,
        },
      ],
      shippingAddress: address,
      discountAmount: 0,
      subtotal: 50,
      shippingFee: 0,
      total: 50,
      status: 'processing',
    });

    // Clean up any old return requests for these orders
    await ReturnRequest.deleteMany({
      order: { $in: [eligibleOrder._id, expiredOrder._id, processingOrder._id] },
    });

    console.log('--- TEST 1: Unauthenticated request ---');
    const resUnauth = await jsonRequest('POST', '/api/returns', {
      orderId: eligibleOrder._id.toString(),
      items: [{ orderItemRef: 0, qty: 1, reason: 'Wrong size delivered' }],
    });
    assert(resUnauth.status === 401, 'POST /api/returns requires authentication (401)');

    console.log('--- TEST 2: Non-existent order ---');
    const nonExistentOrderId = new Types.ObjectId().toString();
    const resNotFound = await jsonRequest(
      'POST',
      '/api/returns',
      {
        orderId: nonExistentOrderId,
        items: [{ orderItemRef: 0, qty: 1, reason: 'Wrong size delivered' }],
      },
      cookieCust1
    );
    assert(resNotFound.status === 404, 'POST /api/returns returns 404 for non-existent order');

    console.log('--- TEST 3: Order belonging to someone else ---');
    const resForbidden = await jsonRequest(
      'POST',
      '/api/returns',
      {
        orderId: eligibleOrder._id.toString(),
        items: [{ orderItemRef: 0, qty: 1, reason: 'Wrong size delivered' }],
      },
      cookieCust2
    );
    assert(resForbidden.status === 403, 'POST /api/returns returns 403 when order belongs to another customer');

    console.log('--- TEST 4: Order not delivered (processing) ---');
    const resNotDelivered = await jsonRequest(
      'POST',
      '/api/returns',
      {
        orderId: processingOrder._id.toString(),
        items: [{ orderItemRef: 0, qty: 1, reason: 'Wrong size delivered' }],
      },
      cookieCust1
    );
    assert(
      resNotDelivered.status === 400 && /delivered/i.test(resNotDelivered.body.message),
      'POST /api/returns rejects non-delivered orders (400)'
    );

    console.log('--- TEST 5: Return window expired (> 7 days) ---');
    const resExpired = await jsonRequest(
      'POST',
      '/api/returns',
      {
        orderId: expiredOrder._id.toString(),
        items: [{ orderItemRef: 0, qty: 1, reason: 'Wrong size delivered' }],
      },
      cookieCust1
    );
    assert(
      resExpired.status === 400 && /expired|7 days/i.test(resExpired.body.message),
      'POST /api/returns rejects orders delivered more than 7 days ago (400)'
    );

    console.log('--- TEST 6: Invalid item reference (out of bounds) ---');
    const resInvalidRef = await jsonRequest(
      'POST',
      '/api/returns',
      {
        orderId: eligibleOrder._id.toString(),
        items: [{ orderItemRef: 99, qty: 1, reason: 'Wrong size delivered' }],
      },
      cookieCust1
    );
    assert(resInvalidRef.status === 400, 'POST /api/returns rejects invalid orderItemRef (400)');

    console.log('--- TEST 7: Quantity exceeding purchased quantity ---');
    const resExcessQty = await jsonRequest(
      'POST',
      '/api/returns',
      {
        orderId: eligibleOrder._id.toString(),
        items: [{ orderItemRef: 0, qty: 5, reason: 'Wrong size delivered' }],
      },
      cookieCust1
    );
    assert(
      resExcessQty.status === 400 && /exceed/i.test(resExcessQty.body.message),
      'POST /api/returns rejects quantity exceeding purchased quantity (400)'
    );

    console.log('--- TEST 8: Validation failure (reason < 5 chars) ---');
    const resShortReason = await jsonRequest(
      'POST',
      '/api/returns',
      {
        orderId: eligibleOrder._id.toString(),
        items: [{ orderItemRef: 0, qty: 1, reason: 'Bad' }],
      },
      cookieCust1
    );
    assert(
      resShortReason.status === 422,
      'POST /api/returns validates reason min 5 chars (422)'
    );

    console.log('--- TEST 9: Successful return request creation ---');
    const resSuccess = await jsonRequest(
      'POST',
      '/api/returns',
      {
        orderId: eligibleOrder._id.toString(),
        items: [
          { orderItemRef: 0, qty: 1, reason: 'Color does not match photo' },
          { orderItemRef: 1, qty: 1, reason: 'Trousers waist too tight' },
        ],
      },
      cookieCust1
    );
    assert(
      resSuccess.status === 201 && resSuccess.body.success === true,
      'POST /api/returns creates return request (201)'
    );
    const createdReturn = resSuccess.body.data?.returnRequest;
    assert(
      createdReturn?.status === 'requested' &&
        createdReturn?.refundPoints === null &&
        createdReturn?.refundMethod === null &&
        createdReturn?.refundedAt === null &&
        createdReturn?.items?.length === 2 &&
        createdReturn?.items[0].sku === 'LINEN-SHIRT-M',
      'ReturnRequest initialized with status "requested" and null refund points/method'
    );

    console.log('--- TEST 10: Duplicate return request blocked ---');
    const resDuplicate = await jsonRequest(
      'POST',
      '/api/returns',
      {
        orderId: eligibleOrder._id.toString(),
        items: [{ orderItemRef: 0, qty: 1, reason: 'Trying to request again' }],
      },
      cookieCust1
    );
    assert(
      resDuplicate.status === 400 && /already/i.test(resDuplicate.body.message),
      'POST /api/returns blocks duplicate active return requests (400)'
    );

    console.log('--- TEST 11: Customer list returns (GET /api/returns/me) ---');
    const resList = await jsonRequest('GET', '/api/returns/me?page=1&limit=5', undefined, cookieCust1);
    assert(
      resList.status === 200 &&
        resList.body.success === true &&
        Array.isArray(resList.body.data.results) &&
        resList.body.data.total >= 1 &&
        resList.body.data.page === 1,
      'GET /api/returns/me returns paginated return requests (200)'
    );

    console.log('--- TEST 12: Customer view single return by ID ---');
    const returnId = createdReturn?._id;
    const resGetSingle = await jsonRequest('GET', `/api/returns/${returnId}`, undefined, cookieCust1);
    assert(
      resGetSingle.status === 200 && resGetSingle.body.data?.returnRequest?._id === returnId,
      'GET /api/returns/:id retrieves return for owner (200)'
    );

    console.log('--- TEST 13: Another customer blocked from viewing return ---');
    const resGetOther = await jsonRequest('GET', `/api/returns/${returnId}`, undefined, cookieCust2);
    assert(
      resGetOther.status === 403,
      'GET /api/returns/:id returns 403 for unauthorized customer'
    );

    console.log('--- TEST 14: Staff can view return by ID ---');
    const resGetStaff = await jsonRequest('GET', `/api/returns/${returnId}`, undefined, cookieStaff);
    assert(
      resGetStaff.status === 200 && resGetStaff.body.data?.returnRequest?._id === returnId,
      'GET /api/returns/:id permits staff access (200)'
    );

    console.log('--- TEST 15: Query return by order ID ---');
    const resByOrder = await jsonRequest(
      'GET',
      `/api/returns/order/${eligibleOrder._id.toString()}`,
      undefined,
      cookieCust1
    );
    assert(
      resByOrder.status === 200 && resByOrder.body.data?.returnRequest?._id === returnId,
      'GET /api/returns/order/:orderId retrieves return by order ID (200)'
    );

    console.log('--- TEST 16: Rejected return allows re-application ---');
    // Set status to rejected
    await ReturnRequest.findByIdAndUpdate(returnId, {
      status: 'rejected',
      rejectionReason: 'Items were worn or damaged',
    });

    const resReapply = await jsonRequest(
      'POST',
      '/api/returns',
      {
        orderId: eligibleOrder._id.toString(),
        items: [{ orderItemRef: 0, qty: 1, reason: 'Re-submitting with unworn item tags intact' }],
      },
      cookieCust1
    );
    assert(
      resReapply.status === 201 && resReapply.body.success === true,
      'POST /api/returns allows re-application after rejection (201)'
    );

    // Clean up test documents
    await ReturnRequest.deleteMany({
      order: { $in: [eligibleOrder._id, expiredOrder._id, processingOrder._id] },
    });
    await Order.deleteMany({
      _id: { $in: [eligibleOrder._id, expiredOrder._id, processingOrder._id] },
    });
    await User.deleteMany({
      _id: { $in: [cust1._id, cust2._id, staffUser._id] },
    });

    console.log(`\n========================================`);
    console.log(`RESULTS: ${passedTests}/${totalTests} tests passed`);
    console.log(`========================================\n`);

    if (passedTests === totalTests) {
      console.log('🎉 ALL P56 TESTS PASSED!');
    } else {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Test suite error:', err);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
    console.log('Test suite closed clean.');
  }
}

runTests().catch((err) => {
  console.error('Fatal unhandled error in runTests:', err);
  process.exit(1);
});
