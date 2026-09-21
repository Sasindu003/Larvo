import http from 'http';
import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { User, IUser } from './src/models/User';
import { Order, IOrder } from './src/models/Order';
import { Payment, IPayment } from './src/models/Payment';
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
  console.log('   P49 Payment Verification Test Suite  ');
  console.log('========================================\n');

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB at', MONGODB_URI);

  // 1. Setup / identify test users
  let staffUser = await User.findOne({ role: 'staff' });
  if (!staffUser) {
    staffUser = await User.create({
      name: 'P49 Staff',
      email: `p49_staff_${Date.now()}@example.com`,
      passwordHash: 'dummy',
      role: 'staff',
    });
  }

  let adminUser = await User.findOne({ role: 'admin' });
  if (!adminUser) {
    adminUser = await User.create({
      name: 'P49 Admin',
      email: `p49_admin_${Date.now()}@example.com`,
      passwordHash: 'dummy',
      role: 'admin',
    });
  }

  let customerUser = await User.findOne({ role: 'customer' });
  if (!customerUser) {
    customerUser = await User.create({
      name: 'P49 Customer',
      email: `p49_customer_${Date.now()}@example.com`,
      passwordHash: 'dummy',
      role: 'customer',
    });
  }

  const staffCookie = makeAuthCookie(staffUser._id.toString());
  const adminCookie = makeAuthCookie(adminUser._id.toString());
  const customerCookie = makeAuthCookie(customerUser._id.toString());

  // Ensure a test product variant exists for order items
  let product = await Product.findOne({ status: 'active' });
  if (!product || !product.variants?.length) {
    product = await Product.create({
      name: 'P49 Test Item',
      slug: `p49-test-item-${Date.now()}`,
      description: 'Test item for P49',
      category: new Types.ObjectId(),
      department: new Types.ObjectId(),
      basePrice: 5000,
      variants: [{ sku: `P49-SKU-${Date.now()}`, size: 'M', color: 'Black', stock: 100 }],
      status: 'active',
    });
  }
  const variantSku = product.variants[0].sku;

  const testOrdersCreated: Types.ObjectId[] = [];
  const testPaymentsCreated: Types.ObjectId[] = [];

  // Helper to create test Order & Payment in given statuses
  async function createOrderWithPayment(
    orderStatus: any,
    paymentMethod: 'bank_transfer' | 'simulated_online' | 'reward_points',
    paymentStatus: 'submitted' | 'approved' | 'rejected',
    extraPayment?: Record<string, any>
  ): Promise<{ order: IOrder; payment: IPayment }> {
    const order = await Order.create({
      user: customerUser!._id,
      items: [
        {
          product: product!._id,
          variantSku,
          name: product!.name,
          image: '/uploads/test.jpg',
          size: 'M',
          color: 'Black',
          unitPrice: 5000,
          quantity: 1,
        },
      ],
      subtotal: 5000,
      shippingFee: 0,
      discountTotal: 0,
      total: 5000,
      pointsPaid: 0,
      status: orderStatus,
      shippingAddress: {
        line1: '123 Test Street',
        city: 'Colombo',
        province: 'Western',
        postalCode: '00100',
        country: 'Sri Lanka',
      },
    });

    const payment = await Payment.create({
      order: order._id,
      method: paymentMethod,
      status: paymentStatus,
      amount: 5000,
      slipImageUrl: paymentMethod === 'bank_transfer' ? '/uploads/payment-slips/test_slip.png' : null,
      ...extraPayment,
    });

    testOrdersCreated.push(order._id);
    testPaymentsCreated.push(payment._id);

    return { order, payment };
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Approve bank transfer payment slip
    // -------------------------------------------------------------------------
    console.log('\n--- Test 1: Approve bank transfer payment slip ---');
    const t1 = await createOrderWithPayment('payment_review', 'bank_transfer', 'submitted');
    const res1 = await jsonRequest(
      'PATCH',
      `/api/admin/payments/${t1.payment._id}/review`,
      { decision: 'approved', note: 'Receipt looks genuine' },
      staffCookie
    );

    assert(res1.status === 200, 'Test 1.1 Status is 200', `Got ${res1.status}: ${JSON.stringify(res1.body)}`);
    assert(res1.body?.data?.order?.status === 'confirmed', 'Test 1.2 Order status moved to confirmed', `Got: ${res1.body?.data?.order?.status}`);
    assert(res1.body?.data?.payment?.status === 'approved', 'Test 1.3 Payment status moved to approved', `Got: ${res1.body?.data?.payment?.status}`);
    assert(
      res1.body?.data?.payment?.reviewedBy?.toString() === staffUser._id.toString(),
      'Test 1.4 Payment.reviewedBy recorded staff ID',
      `Got: ${res1.body?.data?.payment?.reviewedBy}`
    );

    // Verify in DB directly
    const dbOrder1 = await Order.findById(t1.order._id);
    const dbPayment1 = await Payment.findById(t1.payment._id);
    assert(dbOrder1?.status === 'confirmed', 'Test 1.5 DB Order.status is confirmed');
    assert(dbPayment1?.status === 'approved', 'Test 1.6 DB Payment.status is approved');
    assert(dbPayment1?.reviewNote === 'Receipt looks genuine', 'Test 1.7 DB Payment.reviewNote persisted optional note');

    // -------------------------------------------------------------------------
    // TEST 2: Reject bank transfer payment slip with required note
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Reject bank transfer payment slip with note ---');
    const t2 = await createOrderWithPayment('payment_review', 'bank_transfer', 'submitted');
    const res2 = await jsonRequest(
      'PATCH',
      `/api/admin/payments/${t2.payment._id}/review`,
      { decision: 'rejected', note: 'Deposit amount mismatch - only Rs 2000 shown' },
      adminCookie
    );

    assert(res2.status === 200, 'Test 2.1 Status is 200', `Got ${res2.status}: ${JSON.stringify(res2.body)}`);
    assert(res2.body?.data?.order?.status === 'pending_payment', 'Test 2.2 Order returned to pending_payment', `Got: ${res2.body?.data?.order?.status}`);
    assert(res2.body?.data?.payment?.status === 'rejected', 'Test 2.3 Payment status is rejected', `Got: ${res2.body?.data?.payment?.status}`);
    assert(
      res2.body?.data?.payment?.reviewNote === 'Deposit amount mismatch - only Rs 2000 shown',
      'Test 2.4 Payment reviewNote is saved',
      `Got: ${res2.body?.data?.payment?.reviewNote}`
    );

    // Verify in DB directly
    const dbOrder2 = await Order.findById(t2.order._id);
    const dbPayment2 = await Payment.findById(t2.payment._id);
    assert(dbOrder2?.status === 'pending_payment', 'Test 2.5 DB Order.status is pending_payment');
    assert(dbPayment2?.status === 'rejected', 'Test 2.6 DB Payment.status is rejected');
    assert(dbPayment2?.reviewNote === 'Deposit amount mismatch - only Rs 2000 shown', 'Test 2.7 DB Payment.reviewNote persisted in MongoDB');

    // -------------------------------------------------------------------------
    // TEST 3: Reject without note fails with 422
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Reject without note returns 422 ---');
    const t3 = await createOrderWithPayment('payment_review', 'bank_transfer', 'submitted');
    const res3 = await jsonRequest(
      'PATCH',
      `/api/admin/payments/${t3.payment._id}/review`,
      { decision: 'rejected' },
      staffCookie
    );

    assert(res3.status === 422, 'Test 3.1 Status is 422 on rejection without note', `Got: ${res3.status}`);
    assert(
      JSON.stringify(res3.body).toLowerCase().includes('note'),
      'Test 3.2 Error response mentions note requirement',
      `Got: ${JSON.stringify(res3.body)}`
    );

    const res3b = await jsonRequest(
      'PATCH',
      `/api/admin/payments/${t3.payment._id}/review`,
      { decision: 'rejected', note: '   ' },
      staffCookie
    );
    assert(res3b.status === 422, 'Test 3.3 Status is 422 on rejection with whitespace note', `Got: ${res3b.status}`);

    // -------------------------------------------------------------------------
    // TEST 4: Simulated online payment cannot be reviewed (400 already_resolved)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4: Simulated online payment returns 400 already_resolved ---');
    const t4 = await createOrderWithPayment('confirmed', 'simulated_online', 'approved');
    const res4 = await jsonRequest(
      'PATCH',
      `/api/admin/payments/${t4.payment._id}/review`,
      { decision: 'approved' },
      staffCookie
    );

    assert(res4.status === 400, 'Test 4.1 Status is 400 for simulated_online', `Got: ${res4.status}`);
    const isAlreadyResolved4 =
      res4.body?.errors?.code === 'already_resolved' ||
      JSON.stringify(res4.body).includes('already_resolved') ||
      JSON.stringify(res4.body).toLowerCase().includes('automatically resolved');
    assert(isAlreadyResolved4, 'Test 4.2 Error code is already_resolved', `Got: ${JSON.stringify(res4.body)}`);

    // -------------------------------------------------------------------------
    // TEST 5: Reward points payment cannot be reviewed (400 already_resolved)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: Reward points payment returns 400 already_resolved ---');
    const t5 = await createOrderWithPayment('confirmed', 'reward_points', 'approved', { pointsUsed: 5000 });
    const res5 = await jsonRequest(
      'PATCH',
      `/api/admin/payments/${t5.payment._id}/review`,
      { decision: 'rejected', note: 'Not valid' },
      staffCookie
    );

    assert(res5.status === 400, 'Test 5.1 Status is 400 for reward_points', `Got: ${res5.status}`);
    const isAlreadyResolved5 =
      res5.body?.errors?.code === 'already_resolved' ||
      JSON.stringify(res5.body).includes('already_resolved') ||
      JSON.stringify(res5.body).toLowerCase().includes('automatically resolved');
    assert(isAlreadyResolved5, 'Test 5.2 Error code is already_resolved', `Got: ${JSON.stringify(res5.body)}`);

    // -------------------------------------------------------------------------
    // TEST 6: Already approved bank slip returns 409
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: Re-reviewing already-approved payment returns 409 ---');
    const t6 = await createOrderWithPayment('confirmed', 'bank_transfer', 'approved');
    const res6 = await jsonRequest(
      'PATCH',
      `/api/admin/payments/${t6.payment._id}/review`,
      { decision: 'approved' },
      staffCookie
    );

    assert(res6.status === 409, 'Test 6.1 Status is 409 on already-reviewed payment', `Got: ${res6.status}`);

    // -------------------------------------------------------------------------
    // TEST 7: Customer cannot call review endpoint (403)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 7: Customer role access returns 403 ---');
    const t7 = await createOrderWithPayment('payment_review', 'bank_transfer', 'submitted');
    const res7 = await jsonRequest(
      'PATCH',
      `/api/admin/payments/${t7.payment._id}/review`,
      { decision: 'approved' },
      customerCookie
    );

    assert(res7.status === 403, 'Test 7.1 Status is 403 for customer', `Got: ${res7.status}`);

    // Also test without auth -> 401
    const res7b = await jsonRequest(
      'PATCH',
      `/api/admin/payments/${t7.payment._id}/review`,
      { decision: 'approved' }
    );
    assert(res7b.status === 401, 'Test 7.2 Status is 401 for unauthenticated request', `Got: ${res7b.status}`);

    // -------------------------------------------------------------------------
    // TEST 8: Customer order detail endpoint exposes payment.reviewNote
    // -------------------------------------------------------------------------
    console.log('\n--- Test 8: Customer GET /api/orders/:id exposes reviewNote ---');
    const res8 = await jsonRequest(
      'GET',
      `/api/orders/${t2.order._id}`,
      undefined,
      customerCookie
    );

    assert(res8.status === 200, 'Test 8.1 Customer GET order status is 200', `Got: ${res8.status}`);
    const customerOrderPayment = res8.body?.data?.order?.payment;
    assert(
      customerOrderPayment?.reviewNote === 'Deposit amount mismatch - only Rs 2000 shown',
      'Test 8.2 Customer receives payment.reviewNote in response',
      `Got: ${customerOrderPayment?.reviewNote}`
    );
    assert(
      customerOrderPayment?.status === 'rejected',
      'Test 8.3 Customer receives payment.status as rejected',
      `Got: ${customerOrderPayment?.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 9: P46 transition rules regression check
    // -------------------------------------------------------------------------
    console.log('\n--- Test 9: P46 transition rules regression check ---');
    const rule1 = canTransition('payment_review', 'confirmed', 'staff');
    assert(rule1 === true, 'Test 9.1 staff can transition payment_review -> confirmed');

    const rule2 = canTransition('payment_review', 'pending_payment', 'staff');
    assert(rule2 === true, 'Test 9.2 staff can transition payment_review -> pending_payment');

    const rule3 = canTransition('confirmed', 'payment_review', 'staff');
    assert(rule3 === false, 'Test 9.3 staff cannot transition confirmed -> payment_review');

    const rule4 = canTransition('payment_review', 'confirmed', 'customer');
    assert(rule4 === false, 'Test 9.4 customer cannot transition payment_review -> confirmed');

    const rule5 = canTransition('pending_payment', 'payment_review', 'customer', true);
    assert(rule5 === true, 'Test 9.5 customer can transition pending_payment -> payment_review (as owner)');

    // -------------------------------------------------------------------------
    // TEST 10: Direct /api/payments/:paymentId/review alias endpoint
    // -------------------------------------------------------------------------
    console.log('\n--- Test 10: /api/payments/:id/review direct alias route ---');
    const t10 = await createOrderWithPayment('payment_review', 'bank_transfer', 'submitted');
    const res10 = await jsonRequest(
      'PATCH',
      `/api/payments/${t10.payment._id}/review`,
      { decision: 'approved' },
      staffCookie
    );
    assert(res10.status === 200, 'Test 10.1 /api/payments/:id/review route functions identically with 200', `Got: ${res10.status}`);
    assert(res10.body?.data?.order?.status === 'confirmed', 'Test 10.2 Order is confirmed via direct route');

  } finally {
    // Clean up test documents
    console.log('\nCleaning up test fixtures...');
    if (testOrdersCreated.length > 0) {
      await Order.deleteMany({ _id: { $in: testOrdersCreated } });
    }
    if (testPaymentsCreated.length > 0) {
      await Payment.deleteMany({ _id: { $in: testPaymentsCreated } });
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
  console.error('Fatal error in verify_p49:', err);
  process.exit(1);
});
