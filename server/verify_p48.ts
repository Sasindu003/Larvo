import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { User } from './src/models/User';
import { Order, OrderStatus } from './src/models/Order';
import { Payment } from './src/models/Payment';
import { Product } from './src/models/Product';

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

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

async function run() {
  console.log('=== P48: Admin Order Management Verification ===\n');

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB.');

  // 1. Setup test users
  const customerUser = await User.findOneAndUpdate(
    { email: 'p48_customer@test.com' },
    {
      name: 'P48 Customer',
      email: 'p48_customer@test.com',
      passwordHash: 'dummy_hash',
      role: 'customer',
      active: true,
    },
    { upsert: true, new: true }
  );

  const staffUser = await User.findOneAndUpdate(
    { email: 'p48_staff@test.com' },
    {
      name: 'P48 Staff Member',
      email: 'p48_staff@test.com',
      passwordHash: 'dummy_hash',
      role: 'staff',
      active: true,
    },
    { upsert: true, new: true }
  );

  const adminUser = await User.findOneAndUpdate(
    { email: 'p48_admin@test.com' },
    {
      name: 'P48 Admin Member',
      email: 'p48_admin@test.com',
      passwordHash: 'dummy_hash',
      role: 'admin',
      active: true,
    },
    { upsert: true, new: true }
  );

  const customerCookie = makeAuthCookie(customerUser._id.toString());
  const staffCookie = makeAuthCookie(staffUser._id.toString());
  const adminCookie = makeAuthCookie(adminUser._id.toString());

  // 2. Setup a dummy product for order items
  const product = await Product.findOneAndUpdate(
    { slug: 'p48-test-apparel' },
    {
      name: 'P48 Test Apparel',
      slug: 'p48-test-apparel',
      description: 'P48 test product item',
      basePrice: 2500,
      status: 'active',
      variants: [
        {
          sku: 'P48-SKU-01',
          size: 'M',
          color: 'Navy',
          stock: 100,
          price: 2500,
        },
      ],
    },
    { upsert: true, new: true }
  );

  // 3. Create sample test orders
  // Order 1: Pending payment
  const order1 = await Order.create({
    user: customerUser._id,
    items: [
      {
        product: product._id,
        name: product.name,
        image: '/test.jpg',
        variantSku: 'P48-SKU-01',
        size: 'M',
        color: 'Navy',
        unitPrice: 2500,
        quantity: 1,
      },
    ],
    shippingAddress: {
      line1: '123 Fashion Blvd',
      city: 'Colombo',
      province: 'Western',
      postalCode: '00700',
      country: 'Sri Lanka',
    },
    subtotal: 2500,
    shippingFee: 0,
    total: 2500,
    status: 'pending_payment',
    pointsPaid: 0,
  });

  // Order 2: Payment review with slip
  const order2 = await Order.create({
    user: customerUser._id,
    items: [
      {
        product: product._id,
        name: product.name,
        image: '/test.jpg',
        variantSku: 'P48-SKU-01',
        size: 'M',
        color: 'Navy',
        unitPrice: 2500,
        quantity: 2,
      },
    ],
    shippingAddress: {
      line1: '456 Silk Road',
      city: 'Kandy',
      province: 'Central',
      postalCode: '20000',
      country: 'Sri Lanka',
    },
    subtotal: 5000,
    shippingFee: 0,
    total: 5000,
    status: 'payment_review',
    pointsPaid: 0,
  });

  await Payment.create({
    order: order2._id,
    method: 'bank_transfer',
    amount: 5000,
    status: 'submitted',
    slipImageUrl: '/uploads/payment-slips/p48-test-slip.jpg',
  });

  // Order 3: Payment review to test bounce-back
  const order3 = await Order.create({
    user: customerUser._id,
    items: [
      {
        product: product._id,
        name: product.name,
        image: '/test.jpg',
        variantSku: 'P48-SKU-01',
        size: 'M',
        color: 'Navy',
        unitPrice: 2500,
        quantity: 1,
      },
    ],
    shippingAddress: {
      line1: '789 Linen Way',
      city: 'Galle',
      province: 'Southern',
      postalCode: '80000',
      country: 'Sri Lanka',
    },
    subtotal: 2500,
    shippingFee: 60,
    total: 2560,
    status: 'payment_review',
    pointsPaid: 0,
  });

  await Payment.create({
    order: order3._id,
    method: 'bank_transfer',
    amount: 2560,
    status: 'submitted',
    slipImageUrl: '/uploads/payment-slips/p48-invalid-slip.jpg',
  });

  // Order 4: Reward points paid
  const order4 = await Order.create({
    user: customerUser._id,
    items: [
      {
        product: product._id,
        name: product.name,
        image: '/test.jpg',
        variantSku: 'P48-SKU-01',
        size: 'M',
        color: 'Navy',
        unitPrice: 2500,
        quantity: 1,
      },
    ],
    shippingAddress: {
      line1: '10 Cotton Lane',
      city: 'Colombo',
      province: 'Western',
      postalCode: '00300',
      country: 'Sri Lanka',
    },
    subtotal: 2500,
    shippingFee: 0,
    total: 2500,
    status: 'confirmed',
    pointsPaid: 2500,
  });

  await Payment.create({
    order: order4._id,
    method: 'reward_points',
    amount: 2500,
    status: 'approved',
    pointsUsed: 2500,
  });

  console.log('\n--- Test Suite 1: RBAC Enforcement ---');
  {
    // Customer cannot access /api/admin/orders
    const res1 = await jsonRequest('GET', '/api/admin/orders', undefined, customerCookie);
    assert(res1.status === 403, 'Customer hitting GET /api/admin/orders returns 403 Forbidden');

    // Customer cannot access GET /api/orders (admin listing)
    const res2 = await jsonRequest('GET', '/api/orders', undefined, customerCookie);
    assert(res2.status === 403, 'Customer hitting GET /api/orders returns 403 Forbidden');

    // Staff can access /api/admin/orders
    const res3 = await jsonRequest('GET', '/api/admin/orders', undefined, staffCookie);
    assert(res3.status === 200, 'Staff hitting GET /api/admin/orders returns 200 OK');
    assert(res3.body.success === true, 'Response body success is true');
    assert(Array.isArray(res3.body.data.orders), 'Response body data.orders is an Array');

    // Staff can access GET /api/orders
    const res4 = await jsonRequest('GET', '/api/orders', undefined, staffCookie);
    assert(res4.status === 200, 'Staff hitting GET /api/orders returns 200 OK');

    // Admin can access /api/admin/orders
    const res5 = await jsonRequest('GET', '/api/admin/orders', undefined, adminCookie);
    assert(res5.status === 200, 'Admin hitting GET /api/admin/orders returns 200 OK');
  }

  console.log('\n--- Test Suite 2: Pagination & Response Shape ---');
  {
    const res = await jsonRequest('GET', '/api/admin/orders?page=1&limit=2', undefined, staffCookie);
    assert(res.status === 200, 'Paginated response status is 200');
    assert(res.body.data.page === 1, 'Page matches requested page 1');
    assert(res.body.data.orders.length <= 2, 'Limit 2 restricts items per page');
    assert(typeof res.body.data.total === 'number', 'Total orders count returned');
    assert(typeof res.body.data.pages === 'number', 'Total pages count returned');
    assert(typeof res.body.data.results === 'number', 'Results length returned');
  }

  console.log('\n--- Test Suite 3: Status Filtering ---');
  {
    // Filter pending_payment
    const resPending = await jsonRequest(
      'GET',
      '/api/admin/orders?status=pending_payment',
      undefined,
      staffCookie
    );
    assert(resPending.status === 200, 'Status filter pending_payment returns 200');
    const allPending = resPending.body.data.orders.every(
      (o: any) => o.status === 'pending_payment'
    );
    assert(allPending, 'All returned orders have status pending_payment');

    // Filter payment_review
    const resReview = await jsonRequest(
      'GET',
      '/api/admin/orders?status=payment_review',
      undefined,
      staffCookie
    );
    assert(resReview.status === 200, 'Status filter payment_review returns 200');
    const allReview = resReview.body.data.orders.every(
      (o: any) => o.status === 'payment_review'
    );
    assert(allReview, 'All returned orders have status payment_review');
  }

  console.log('\n--- Test Suite 4: Search Capability ---');
  {
    // Search by order ID
    const resSearchId = await jsonRequest(
      'GET',
      `/api/admin/orders?search=${order1._id}`,
      undefined,
      staffCookie
    );
    assert(resSearchId.status === 200, 'Search by Order ID returns 200');
    assert(
      resSearchId.body.data.orders.some((o: any) => o._id === order1._id.toString()),
      'Search found exact order by ObjectId'
    );

    // Search by customer name
    const resSearchCust = await jsonRequest(
      'GET',
      '/api/admin/orders?search=P48%20Customer',
      undefined,
      staffCookie
    );
    assert(resSearchCust.status === 200, 'Search by customer name returns 200');
    assert(
      resSearchCust.body.data.orders.length > 0,
      'Search returned orders matching customer name'
    );
  }

  console.log('\n--- Test Suite 5: Single Order Detail & Payment Population ---');
  {
    const resDetail = await jsonRequest(
      'GET',
      `/api/admin/orders/${order2._id}`,
      undefined,
      staffCookie
    );
    assert(resDetail.status === 200, 'GET /api/admin/orders/:id returns 200');
    const orderData = resDetail.body.data.order;
    assert(orderData._id === order2._id.toString(), 'Order ID matches requested');
    assert(orderData.user && orderData.user.name, 'Customer name is populated');
    assert(orderData.payment !== undefined, 'Payment object is attached');
    assert(
      orderData.payment?.method === 'bank_transfer',
      'Payment method is correctly bank_transfer'
    );
    assert(
      orderData.payment?.slipImageUrl === '/uploads/payment-slips/p48-test-slip.jpg',
      'Bank slip image URL is present in payment detail'
    );
  }

  console.log('\n--- Test Suite 6: Staff Slip Approval (Confirm Order) ---');
  {
    // Approve order2 bank slip: transition payment_review -> confirmed
    const resApprove = await jsonRequest(
      'PATCH',
      `/api/orders/${order2._id}/status`,
      { status: 'confirmed' },
      staffCookie
    );
    assert(resApprove.status === 200, 'Staff approving slip returns 200');
    assert(
      resApprove.body.data.order.status === 'confirmed',
      'Order status advanced to confirmed'
    );

    // Check payment record updated to approved
    const updatedPayment = await Payment.findOne({ order: order2._id });
    assert(
      updatedPayment?.status === 'approved',
      'Payment status was atomically updated to approved'
    );
    assert(
      updatedPayment?.reviewedBy?.toString() === staffUser._id.toString(),
      'Payment reviewedBy recorded staff user ID'
    );
  }

  console.log('\n--- Test Suite 7: Staff Slip Rejection (Bounce Back Order) ---');
  {
    // Reject order3 bank slip: transition payment_review -> pending_payment
    const resReject = await jsonRequest(
      'PATCH',
      `/api/orders/${order3._id}/status`,
      { status: 'pending_payment' },
      staffCookie
    );
    assert(resReject.status === 200, 'Staff rejecting slip returns 200');
    assert(
      resReject.body.data.order.status === 'pending_payment',
      'Order status bounced back to pending_payment'
    );

    // Check payment record updated to rejected
    const rejectedPayment = await Payment.findOne({ order: order3._id });
    assert(
      rejectedPayment?.status === 'rejected',
      'Payment status was atomically updated to rejected'
    );
  }

  console.log('\n--- Test Suite 8: Reward Points Payment Detail ---');
  {
    const resPointsOrder = await jsonRequest(
      'GET',
      `/api/admin/orders/${order4._id}`,
      undefined,
      staffCookie
    );
    assert(resPointsOrder.status === 200, 'GET points order detail returns 200');
    const orderData = resPointsOrder.body.data.order;
    assert(orderData.pointsPaid === 2500, 'Order pointsPaid is 2500');
    assert(
      orderData.payment?.method === 'reward_points',
      'Payment method is reward_points'
    );
    assert(
      orderData.payment?.pointsUsed === 2500,
      'Payment pointsUsed is 2500'
    );
  }

  console.log('\n--- Cleanup Test Fixtures ---');
  await Order.deleteMany({
    _id: { $in: [order1._id, order2._id, order3._id, order4._id] },
  });
  await Payment.deleteMany({
    order: { $in: [order1._id, order2._id, order3._id, order4._id] },
  });
  await User.deleteMany({
    _id: { $in: [customerUser._id, staffUser._id, adminUser._id] },
  });
  await Product.deleteOne({ _id: product._id });
  console.log('Cleaned up test data.');

  console.log(`\nVerification Complete: ${passed} passed, ${failed} failed.`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
