import http from 'http';
import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import app from './src/app';
import { User } from './src/models/User';
import { Order } from './src/models/Order';
import { ReturnRequest } from './src/models/ReturnRequest';
import { walletService } from './src/services/wallet.service';

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

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName}${detail ? ` — ${detail}` : ''}`);
  }
}

async function runTests() {
  console.log('Connecting to MongoDB at', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  // Start HTTP server on dynamic port
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as any;
      serverPort = addr.port;
      console.log(`Test server running on port ${serverPort}`);
      resolve();
    });
  });

  try {
    // 1. Setup Test Users
    console.log('\n--- 1. Setting up test users ---');
    const customerUser = await User.findOneAndUpdate(
      { email: 'p57_customer@larvo.com' },
      {
        email: 'p57_customer@larvo.com',
        name: 'P57 Customer',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
        role: 'customer',
        isActive: true,
      },
      { upsert: true, new: true }
    );

    const staffUser = await User.findOneAndUpdate(
      { email: 'p57_staff@larvo.com' },
      {
        email: 'p57_staff@larvo.com',
        name: 'P57 Staff',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
        role: 'staff',
        isActive: true,
      },
      { upsert: true, new: true }
    );

    const adminUser = await User.findOneAndUpdate(
      { email: 'p57_admin@larvo.com' },
      {
        email: 'p57_admin@larvo.com',
        name: 'P57 Admin',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
        role: 'admin',
        isActive: true,
      },
      { upsert: true, new: true }
    );

    const customerCookie = makeAuthCookie(customerUser._id.toString());
    const staffCookie = makeAuthCookie(staffUser._id.toString());
    const adminCookie = makeAuthCookie(adminUser._id.toString());

    // 2. Setup Delivered Orders and Return Requests
    console.log('\n--- 2. Setting up test orders and return requests ---');
    const dummyProductId = new Types.ObjectId();
    const order1 = await Order.create({
      user: customerUser._id,
      items: [
        {
          product: dummyProductId,
          name: 'P57 Silk Shirt',
          image: '/uploads/sample.jpg',
          variantSku: 'P57-SHIRT-M',
          size: 'M',
          color: 'Navy',
          unitPrice: 120,
          quantity: 2,
        },
        {
          product: dummyProductId,
          name: 'P57 Chino Pants',
          image: '/uploads/sample2.jpg',
          variantSku: 'P57-PANTS-32',
          size: '32',
          color: 'Khaki',
          unitPrice: 80,
          quantity: 1,
        },
      ],
      shippingAddress: {
        line1: '123 Main St',
        city: 'Colombo',
        province: 'Western',
        postalCode: '00100',
        country: 'LK',
      },
      subtotal: 320,
      discountAmount: 20, // $20 discount on $320 subtotal
      shippingFee: 0,
      total: 300,
      status: 'delivered',
      deliveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      pointsPaid: 0,
    });

    // Return request 1 (to be rejected)
    const returnReq1 = await ReturnRequest.create({
      order: order1._id,
      user: customerUser._id,
      items: [
        {
          orderItemRef: 0,
          sku: 'P57-SHIRT-M',
          qty: 1,
          reason: 'Size too large for me',
        },
      ],
      status: 'requested',
    });

    // Return request 2 (to be approved)
    const order2 = await Order.create({
      user: customerUser._id,
      items: [
        {
          product: dummyProductId,
          name: 'P57 Wool Blazer',
          image: '/uploads/sample3.jpg',
          variantSku: 'P57-BLAZER-L',
          size: 'L',
          color: 'Charcoal',
          unitPrice: 200,
          quantity: 1,
        },
      ],
      shippingAddress: {
        line1: '456 Queen St',
        city: 'Colombo',
        province: 'Western',
        postalCode: '00100',
        country: 'LK',
      },
      subtotal: 200,
      discountAmount: 0,
      shippingFee: 0,
      total: 200,
      status: 'delivered',
      deliveredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      pointsPaid: 0,
    });

    const returnReq2 = await ReturnRequest.create({
      order: order2._id,
      user: customerUser._id,
      items: [
        {
          orderItemRef: 0,
          sku: 'P57-BLAZER-L',
          qty: 1,
          reason: 'Fabric differs from website photo',
        },
      ],
      status: 'requested',
    });

    console.log(`Created return requests: ${returnReq1._id}, ${returnReq2._id}`);

    // --- TEST 1: GET /api/admin/returns unauthenticated -> 401 ---
    console.log('\n--- 3. Testing GET /api/admin/returns auth ---');
    const res1 = await jsonRequest('GET', '/api/admin/returns');
    assert(res1.status === 401, 'GET /api/admin/returns unauthenticated returns 401', `Got status ${res1.status}`);

    // --- TEST 2: GET /api/admin/returns as customer -> 403 ---
    const res2 = await jsonRequest('GET', '/api/admin/returns', undefined, customerCookie);
    assert(res2.status === 403, 'GET /api/admin/returns as customer returns 403', `Got status ${res2.status}`);

    // --- TEST 3: GET /api/admin/returns as staff -> 200 with estimatedRefundPoints ---
    const res3 = await jsonRequest('GET', '/api/admin/returns', undefined, staffCookie);
    assert(res3.status === 200, 'GET /api/admin/returns as staff returns 200', `Got status ${res3.status}`);
    assert(res3.body?.success === true, 'GET /api/admin/returns response has success: true');
    assert(Array.isArray(res3.body?.data?.results), 'GET /api/admin/returns response contains results array');

    const foundReq1 = res3.body?.data?.results?.find((r: any) => r._id === returnReq1._id.toString());
    assert(!!foundReq1, 'Results contain returnReq1');
    assert(
      typeof foundReq1?.estimatedRefundPoints === 'number' && foundReq1.estimatedRefundPoints > 0,
      'returnReq1 has server-calculated numeric estimatedRefundPoints',
      `Got ${foundReq1?.estimatedRefundPoints}`
    );

    // Verify calculation matches walletService directly
    // order1 subtotal 320, discount 20. Return item: 1 * 120 = 120 gross.
    // prop discount = (120 * 20) / 320 = 7.5. refund amount = floor(120 - 7.5) = 112. points = 112 * 100 = 11200.
    const expectedPoints1 = walletService.calculateRefundPoints(
      { subtotal: 320, discountAmount: 20 },
      [{ unitPrice: 120, quantity: 1 }]
    );
    assert(
      foundReq1?.estimatedRefundPoints === expectedPoints1,
      `estimatedRefundPoints equals walletService calculation (${expectedPoints1})`,
      `Got ${foundReq1?.estimatedRefundPoints}, expected ${expectedPoints1}`
    );

    // --- TEST 4: GET /api/admin/returns?status=requested filter ---
    console.log('\n--- 4. Testing GET /api/admin/returns filtering ---');
    const res4 = await jsonRequest('GET', '/api/admin/returns?status=requested', undefined, staffCookie);
    assert(res4.status === 200, 'GET /api/admin/returns?status=requested returns 200');
    const allRequested = res4.body?.data?.results?.every((r: any) => r.status === 'requested');
    assert(allRequested, 'All returned items have status "requested"');

    // --- TEST 5: PATCH decision unauthenticated -> 401 ---
    console.log('\n--- 5. Testing PATCH /api/admin/returns/:id/decision auth ---');
    const res5 = await jsonRequest('PATCH', `/api/admin/returns/${returnReq1._id}/decision`, {
      decision: 'rejected',
      rejectionReason: 'Invalid reason',
    });
    assert(res5.status === 401, 'PATCH /api/admin/returns/:id/decision unauthenticated returns 401', `Got ${res5.status}`);

    // --- TEST 6: PATCH decision as customer -> 403 ---
    const res6 = await jsonRequest(
      'PATCH',
      `/api/admin/returns/${returnReq1._id}/decision`,
      { decision: 'rejected', rejectionReason: 'Invalid reason' },
      customerCookie
    );
    assert(res6.status === 403, 'PATCH /api/admin/returns/:id/decision as customer returns 403', `Got ${res6.status}`);

    // --- TEST 7: PATCH rejection without reason -> 400 ---
    console.log('\n--- 6. Testing PATCH rejection validation (hard backend constraint) ---');
    const res7 = await jsonRequest(
      'PATCH',
      `/api/admin/returns/${returnReq1._id}/decision`,
      { decision: 'rejected' },
      staffCookie
    );
    assert(res7.status === 400, 'PATCH rejection with missing reason returns 400', `Got ${res7.status}`);

    // --- TEST 8: PATCH rejection with empty/spaces reason -> 400 ---
    const res8 = await jsonRequest(
      'PATCH',
      `/api/admin/returns/${returnReq1._id}/decision`,
      { decision: 'rejected', rejectionReason: '   ' },
      staffCookie
    );
    assert(res8.status === 400, 'PATCH rejection with blank whitespace reason returns 400', `Got ${res8.status}`);

    // --- TEST 8b: PATCH rejection with too short reason (< 5 chars) -> 400 ---
    const res8b = await jsonRequest(
      'PATCH',
      `/api/admin/returns/${returnReq1._id}/decision`,
      { decision: 'rejected', rejectionReason: 'bad' },
      staffCookie
    );
    assert(res8b.status === 400, 'PATCH rejection with reason < 5 chars returns 400', `Got ${res8b.status}`);

    // --- TEST 9: PATCH rejection with valid reason -> 200, status: 'rejected' ---
    console.log('\n--- 7. Testing valid rejection decision ---');
    const validReason = 'Item shows clear signs of wear and tag is missing.';
    const res9 = await jsonRequest(
      'PATCH',
      `/api/admin/returns/${returnReq1._id}/decision`,
      { decision: 'rejected', rejectionReason: validReason },
      staffCookie
    );
    assert(res9.status === 200, 'PATCH valid rejection returns 200', `Got ${res9.status}`);
    assert(res9.body?.data?.returnRequest?.status === 'rejected', 'Updated status is "rejected"');
    assert(
      res9.body?.data?.returnRequest?.rejectionReason === validReason,
      'Rejection reason is stored accurately'
    );

    // Verify in database
    const dbReq1 = await ReturnRequest.findById(returnReq1._id);
    assert(dbReq1?.status === 'rejected', 'Database document status is "rejected"');
    assert(dbReq1?.rejectionReason === validReason, 'Database document stores rejectionReason');

    // --- TEST 10: PATCH approval -> 200, status: 'approved', stores estimatedRefundPoints ---
    console.log('\n--- 8. Testing valid approval decision ---');
    const expectedPoints2 = walletService.calculateRefundPoints(
      { subtotal: 200, discountAmount: 0 },
      [{ unitPrice: 200, quantity: 1 }]
    ); // 200 * 100 = 20000 points

    const res10 = await jsonRequest(
      'PATCH',
      `/api/admin/returns/${returnReq2._id}/decision`,
      { decision: 'approved' },
      adminCookie
    );
    assert(res10.status === 200, 'PATCH valid approval returns 200', `Got ${res10.status}`);
    assert(
      res10.body?.data?.returnRequest?.status === 'pickup_scheduled' ||
        res10.body?.data?.returnRequest?.status === 'approved',
      'Updated status is "pickup_scheduled" (or "approved")'
    );
    assert(res10.body?.data?.returnRequest?.rejectionReason === null, 'Rejection reason is cleared to null');
    assert(
      res10.body?.data?.returnRequest?.estimatedRefundPoints === expectedPoints2,
      `Approval persisted estimatedRefundPoints (${expectedPoints2})`,
      `Got ${res10.body?.data?.returnRequest?.estimatedRefundPoints}, expected ${expectedPoints2}`
    );

    // Verify in database
    const dbReq2 = await ReturnRequest.findById(returnReq2._id);
    assert(
      dbReq2?.status === 'pickup_scheduled' || dbReq2?.status === 'approved',
      'Database document status is "pickup_scheduled" (or "approved")'
    );
    assert(
      dbReq2?.estimatedRefundPoints === expectedPoints2,
      'Database document persisted estimatedRefundPoints'
    );
    assert(dbReq2?.rejectionReason === null, 'Database document rejectionReason is null');

    // --- TEST 11: GET /api/admin/returns reflects updated statuses ---
    console.log('\n--- 9. Testing listing reflects decisions ---');
    const res11 = await jsonRequest('GET', '/api/admin/returns', undefined, staffCookie);
    const approvedItem = res11.body?.data?.results?.find((r: any) => r._id === returnReq2._id.toString());
    assert(
      approvedItem?.status === 'pickup_scheduled' || approvedItem?.status === 'approved',
      'Listing shows returnReq2 as pickup_scheduled (or approved)'
    );
    assert(
      approvedItem?.estimatedRefundPoints === expectedPoints2,
      'Listing provides persisted estimatedRefundPoints for approved item'
    );

    const rejectedItem = res11.body?.data?.results?.find((r: any) => r._id === returnReq1._id.toString());
    assert(rejectedItem?.status === 'rejected', 'Listing shows returnReq1 as rejected');
    assert(rejectedItem?.rejectionReason === validReason, 'Listing includes rejectionReason for rejected item');

  } catch (err) {
    console.error('Unexpected test error:', err);
    failedTests++;
  } finally {
    // Cleanup test data
    console.log('\nCleaning up test data...');
    await ReturnRequest.deleteMany({
      _id: { $in: [returnReq1?._id, returnReq2?._id].filter(Boolean) },
    });
    await Order.deleteMany({
      'items.name': { $in: ['P57 Silk Shirt', 'P57 Wool Blazer'] },
    });
    await User.deleteMany({
      email: { $in: ['p57_customer@larvo.com', 'p57_staff@larvo.com', 'p57_admin@larvo.com'] },
    });

    if (server) server.close();
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');

    console.log('\n=======================================');
    console.log(`P57 Verification Results: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
    console.log('=======================================');

    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

// Scoped variables for cleanup block
let returnReq1: any = null;
let returnReq2: any = null;

runTests();
