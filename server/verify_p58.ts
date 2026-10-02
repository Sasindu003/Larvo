import http from 'http';
import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import app from './src/app';
import { User } from './src/models/User';
import { Order } from './src/models/Order';
import { ReturnRequest } from './src/models/ReturnRequest';
import { Wallet } from './src/models/Wallet';
import { PointsTransaction } from './src/models/PointsTransaction';
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

  const createdUserIds: Types.ObjectId[] = [];
  const createdOrderIds: Types.ObjectId[] = [];
  const createdReturnIds: Types.ObjectId[] = [];

  try {
    // 1. Setup Test Users
    console.log('\n--- 1. Setting up test users ---');
    const timestamp = Date.now();

    const customer = await User.create({
      name: `P58 Customer ${timestamp}`,
      email: `p58_cust_${timestamp}@test.com`,
      password: 'Password123!',
      role: 'customer',
      phone: '555-0101',
    });
    createdUserIds.push(customer._id);
    const customerCookie = makeAuthCookie(customer._id.toString());

    const deliveryManager = await User.create({
      name: `P58 Delivery Manager ${timestamp}`,
      email: `p58_dm_${timestamp}@test.com`,
      password: 'Password123!',
      role: 'delivery_manager',
    });
    createdUserIds.push(deliveryManager._id);
    const dmCookie = makeAuthCookie(deliveryManager._id.toString());

    const staff = await User.create({
      name: `P58 Staff ${timestamp}`,
      email: `p58_staff_${timestamp}@test.com`,
      password: 'Password123!',
      role: 'staff',
    });
    createdUserIds.push(staff._id);
    const staffCookie = makeAuthCookie(staff._id.toString());

    const admin = await User.create({
      name: `P58 Admin ${timestamp}`,
      email: `p58_admin_${timestamp}@test.com`,
      password: 'Password123!',
      role: 'admin',
    });
    createdUserIds.push(admin._id);
    const adminCookie = makeAuthCookie(admin._id.toString());

    assert(!!customer._id && !!deliveryManager._id && !!staff._id && !!admin._id, 'Created 4 test users (customer, delivery_manager, staff, admin)');

    // 2. Setup Test Orders
    console.log('\n--- 2. Setting up delivered test orders ---');
    const deliveredAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago (within 7-day window)
    const dummyProductId = new Types.ObjectId();

    // Order 1: Subtotal $100, discount $10, total $90 -> 90 points return estimate
    const order1 = await Order.create({
      orderNumber: `ORD-P58-${timestamp}-1`,
      user: customer._id,
      status: 'delivered',
      deliveredAt,
      subtotal: 100,
      discountAmount: 10,
      shippingFee: 0,
      total: 90,
      totalAmount: 90,
      paymentMethod: 'card',
      paymentStatus: 'paid',
      shippingAddress: {
        recipientName: customer.name,
        line1: '123 Test St',
        street: '123 Test St',
        city: 'Metropolis',
        province: 'NY',
        postalCode: '10001',
        country: 'USA',
      },
      contactPhone: '555-0101',
      items: [
        {
          product: dummyProductId,
          productId: dummyProductId,
          variantSku: `SKU-P58-A-${timestamp}`,
          name: 'Classic Oxford Shirt',
          image: '/uploads/sample1.jpg',
          size: 'M',
          color: 'Blue',
          unitPrice: 100,
          quantity: 1,
          totalPrice: 100,
        },
      ],
    });
    createdOrderIds.push(order1._id);

    // Order 2: Another order for transition validation
    const order2 = await Order.create({
      orderNumber: `ORD-P58-${timestamp}-2`,
      user: customer._id,
      status: 'delivered',
      deliveredAt,
      subtotal: 80,
      discountAmount: 0,
      shippingFee: 0,
      total: 80,
      totalAmount: 80,
      paymentMethod: 'card',
      paymentStatus: 'paid',
      shippingAddress: {
        recipientName: customer.name,
        line1: '456 Second Ave',
        street: '456 Second Ave',
        city: 'Metropolis',
        province: 'NY',
        postalCode: '10002',
        country: 'USA',
      },
      contactPhone: '555-0101',
      items: [
        {
          product: dummyProductId,
          productId: dummyProductId,
          variantSku: `SKU-P58-B-${timestamp}`,
          name: 'Chino Pants',
          image: '/uploads/sample2.jpg',
          size: '32',
          color: 'Khaki',
          unitPrice: 80,
          quantity: 1,
          totalPrice: 80,
        },
      ],
    });
    createdOrderIds.push(order2._id);

    assert(!!order1._id && !!order2._id, 'Delivered orders created with valid 7-day timestamps');

    // 3. Customer submits return requests
    console.log('\n--- 3. Customer submits return requests ---');
    const submitRes1 = await jsonRequest(
      'POST',
      '/api/returns',
      {
        orderId: order1._id.toString(),
        items: [{ orderItemRef: 0, qty: 1, reason: 'Size too large and loose fitting' }],
      },
      customerCookie
    );
    assert(submitRes1.status === 201, 'Customer submits return request 1 (201 Created)');
    const returnId1 = submitRes1.body.data.returnRequest._id;
    createdReturnIds.push(new Types.ObjectId(returnId1));

    const submitRes2 = await jsonRequest(
      'POST',
      '/api/returns',
      {
        orderId: order2._id.toString(),
        items: [{ orderItemRef: 0, qty: 1, reason: 'Color different from pictures shown' }],
      },
      customerCookie
    );
    assert(submitRes2.status === 201, 'Customer submits return request 2 (201 Created)');
    const returnId2 = submitRes2.body.data.returnRequest._id;
    createdReturnIds.push(new Types.ObjectId(returnId2));

    // 4. Admin approval sets status to 'pickup_scheduled' directly
    console.log('\n--- 4. Admin approval sets status to pickup_scheduled ---');
    const approveRes1 = await jsonRequest(
      'PATCH',
      `/api/admin/returns/${returnId1}/decision`,
      { decision: 'approved' },
      adminCookie
    );
    assert(approveRes1.status === 200, 'Admin approves return request 1 (200 OK)');
    assert(
      approveRes1.body.data.returnRequest.status === 'pickup_scheduled',
      'Approval sets status to pickup_scheduled directly (NOT approved)',
      `Actual status: ${approveRes1.body.data.returnRequest.status}`
    );
    assert(
      approveRes1.body.data.returnRequest.estimatedRefundPoints === 9000,
      'estimatedRefundPoints correctly calculated and persisted (9000 pts for $90 net at 100pts/$)',
      `Actual points: ${approveRes1.body.data.returnRequest.estimatedRefundPoints}`
    );

    // Also approve return 2
    const approveRes2 = await jsonRequest(
      'PATCH',
      `/api/admin/returns/${returnId2}/decision`,
      { decision: 'approved' },
      adminCookie
    );
    assert(approveRes2.status === 200 && approveRes2.body.data.returnRequest.status === 'pickup_scheduled', 'Return 2 approved and set to pickup_scheduled');

    // 5. GET /api/delivery/returns Queue & Role Guards
    console.log('\n--- 5. Testing GET /api/delivery/returns & Role Guards ---');
    const unauthDeliveryRes = await jsonRequest('GET', '/api/delivery/returns');
    assert(unauthDeliveryRes.status === 401, 'Unauthenticated access to /api/delivery/returns returns 401');

    const customerDeliveryRes = await jsonRequest('GET', '/api/delivery/returns', undefined, customerCookie);
    assert(customerDeliveryRes.status === 403, 'Customer access to /api/delivery/returns returns 403 Forbidden');

    const dmDeliveryRes = await jsonRequest('GET', '/api/delivery/returns', undefined, dmCookie);
    assert(dmDeliveryRes.status === 200, 'Delivery manager access to /api/delivery/returns returns 200 OK');
    assert(
      Array.isArray(dmDeliveryRes.body.data.results) && dmDeliveryRes.body.data.total >= 2,
      'Delivery returns queue returns list of results and total count'
    );
    const foundReturn1 = dmDeliveryRes.body.data.results.find((r: any) => r._id === returnId1);
    assert(!!foundReturn1, 'Approved return 1 appears in delivery manager queue');
    assert(
      foundReturn1 && typeof foundReturn1.order === 'object' && typeof foundReturn1.user === 'object',
      'Delivery return contains populated user and order'
    );

    // 6. PATCH /api/delivery/returns/:id/status Lifecycle Enforcement
    console.log('\n--- 6. Testing delivery pickup status advancement & lifecycle ---');
    // Role guard: Customer cannot advance delivery pickup
    const custAdvanceRes = await jsonRequest(
      'PATCH',
      `/api/delivery/returns/${returnId1}/status`,
      { status: 'picked_up' },
      customerCookie
    );
    assert(custAdvanceRes.status === 403, 'Customer cannot advance pickup status (403 Forbidden)');

    // Invalid transition: cannot skip picked_up and jump directly to received
    const invalidSkipRes = await jsonRequest(
      'PATCH',
      `/api/delivery/returns/${returnId1}/status`,
      { status: 'received' },
      dmCookie
    );
    assert(
      invalidSkipRes.status === 400,
      'Cannot skip from pickup_scheduled directly to received (400 Bad Request)',
      invalidSkipRes.body.message
    );

    // Invalid status: unknown / unauthorized status value (e.g. refunded)
    const invalidStatusRes = await jsonRequest(
      'PATCH',
      `/api/delivery/returns/${returnId1}/status`,
      { status: 'refunded' },
      dmCookie
    );
    assert(invalidStatusRes.status === 400, 'Invalid status value rejected with 400 Bad Request');

    // Valid advance 1: pickup_scheduled -> picked_up
    const advancePickedUpRes = await jsonRequest(
      'PATCH',
      `/api/delivery/returns/${returnId1}/status`,
      { status: 'picked_up' },
      dmCookie
    );
    assert(advancePickedUpRes.status === 200, 'Delivery manager marks return 1 as picked_up (200 OK)');
    assert(
      advancePickedUpRes.body.data.returnRequest.status === 'picked_up',
      'Return 1 status is now picked_up'
    );

    // Invalid backwards transition: picked_up -> pickup_scheduled
    const invalidBackwardsRes = await jsonRequest(
      'PATCH',
      `/api/delivery/returns/${returnId1}/status`,
      { status: 'picked_up' },
      dmCookie
    );
    assert(invalidBackwardsRes.status === 400, 'Cannot transition from picked_up to picked_up again (400 Bad Request)');

    // 7. Role Guard: delivery_manager CANNOT process refund
    console.log('\n--- 7. Role guard: delivery_manager and staff CANNOT process refund ---');
    const dmRefundRes = await jsonRequest(
      'PATCH',
      `/api/admin/returns/${returnId1}/refund`,
      {},
      dmCookie
    );
    assert(dmRefundRes.status === 403, 'delivery_manager cannot call /refund endpoint (403 Forbidden)');

    const staffRefundRes = await jsonRequest(
      'PATCH',
      `/api/admin/returns/${returnId1}/refund`,
      {},
      staffCookie
    );
    assert(staffRefundRes.status === 403, 'staff cannot call /refund endpoint (403 Forbidden)');

    // 8. Refund pre-condition: return must be in 'received' status
    console.log('\n--- 8. Refund pre-condition: must be in received status ---');
    const adminPrematureRefundRes = await jsonRequest(
      'PATCH',
      `/api/admin/returns/${returnId1}/refund`,
      {},
      adminCookie
    );
    assert(
      adminPrematureRefundRes.status === 400,
      'Admin cannot refund when return is in picked_up status (400 Bad Request)',
      adminPrematureRefundRes.body.message
    );

    // Valid advance 2: picked_up -> received
    const advanceReceivedRes = await jsonRequest(
      'PATCH',
      `/api/delivery/returns/${returnId1}/status`,
      { status: 'received' },
      dmCookie
    );
    assert(advanceReceivedRes.status === 200, 'Delivery manager marks return 1 as received (200 OK)');
    assert(
      advanceReceivedRes.body.data.returnRequest.status === 'received',
      'Return 1 status is now received'
    );

    // 9. Process Refund via Admin
    console.log('\n--- 9. Admin processes refund to wallet ---');
    // Check initial customer wallet balance
    const initialWallet = await walletService.getOrCreateWallet(customer._id);
    const initialBalance = initialWallet.balancePoints;

    const refundRes = await jsonRequest(
      'PATCH',
      `/api/admin/returns/${returnId1}/refund`,
      {},
      adminCookie
    );
    assert(refundRes.status === 200, 'Admin processes refund successfully (200 OK)');
    const refundedDoc = refundRes.body.data.returnRequest;

    assert(refundedDoc.status === 'refunded', 'Return document status is updated to refunded');
    assert(refundedDoc.refundPoints === 9000, 'Return document refundPoints equals 9000');
    assert(refundedDoc.refundMethod === 'wallet_points', 'refundMethod is set to wallet_points');
    assert(!!refundedDoc.refundedAt, 'refundedAt timestamp is recorded');

    // Check wallet balance increment
    const updatedWallet = await Wallet.findOne({ user: customer._id });
    assert(
      updatedWallet?.balancePoints === initialBalance + 9000,
      `Customer wallet balance incremented by exactly 9000 points (from ${initialBalance} to ${updatedWallet?.balancePoints})`
    );

    // Check ledger transaction
    const expectedIdempotencyKey = `return_refund:${returnId1}`;
    const txRecords = await PointsTransaction.find({ idempotencyKey: expectedIdempotencyKey });
    assert(txRecords.length === 1, `Exactly 1 ledger transaction found with key ${expectedIdempotencyKey}`);
    const tx = txRecords[0];
    assert(tx.type === 'refund_earn', 'Ledger transaction type is refund_earn');
    assert(tx.direction === 'credit', 'Ledger transaction direction is credit');
    assert(tx.points === 9000, 'Ledger transaction points is 9000');
    assert(tx.returnRequest?.toString() === returnId1, 'Ledger transaction links to returnRequestId');

    // 10. Duplicate Refund Idempotency
    console.log('\n--- 10. Testing duplicate refund idempotency ---');
    const duplicateRefundRes = await jsonRequest(
      'PATCH',
      `/api/admin/returns/${returnId1}/refund`,
      {},
      adminCookie
    );
    assert(duplicateRefundRes.status === 200, 'Duplicate refund call returns 200 OK (idempotent)');

    // Verify wallet balance did NOT increase again
    const walletAfterDuplicate = await Wallet.findOne({ user: customer._id });
    assert(
      walletAfterDuplicate?.balancePoints === initialBalance + 9000,
      'Customer wallet balance did NOT increase on duplicate call'
    );

    // Verify ledger records count is still exactly 1
    const txRecordsAfterDuplicate = await PointsTransaction.find({ idempotencyKey: expectedIdempotencyKey });
    assert(
      txRecordsAfterDuplicate.length === 1,
      'No duplicate ledger rows created on duplicate call'
    );

    // 11. P56 customer regression: customer can view updated return status
    console.log('\n--- 11. Customer view regression: can view updated return status ---');
    const customerGetRes = await jsonRequest('GET', `/api/returns/${returnId1}`, undefined, customerCookie);
    assert(customerGetRes.status === 200, 'Customer can view return request by ID (200 OK)');
    assert(
      customerGetRes.body.data.returnRequest.status === 'refunded',
      'Customer sees status as refunded'
    );
    assert(
      customerGetRes.body.data.returnRequest.refundPoints === 9000,
      'Customer sees refundPoints in details'
    );

  } finally {
    console.log('\n--- Cleaning up test artifacts ---');
    if (createdReturnIds.length > 0) {
      await ReturnRequest.deleteMany({ _id: { $in: createdReturnIds } });
    }
    if (createdOrderIds.length > 0) {
      await Order.deleteMany({ _id: { $in: createdOrderIds } });
    }
    if (createdUserIds.length > 0) {
      await PointsTransaction.deleteMany({ user: { $in: createdUserIds } });
      await Wallet.deleteMany({ user: { $in: createdUserIds } });
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    console.log('Cleanup completed.');

    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await mongoose.disconnect();
  }

  console.log('\n========================================');
  console.log(`TOTAL TESTS: ${totalTests}`);
  console.log(`PASSED:      ${passedTests}`);
  console.log(`FAILED:      ${failedTests}`);
  console.log('========================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
