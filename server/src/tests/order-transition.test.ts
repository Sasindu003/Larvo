import dotenv from 'dotenv';
dotenv.config();

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-1234567890';

import mongoose, { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import http from 'http';
import app from '../app';
import User from '../models/User';
import Order, { IOrder } from '../models/Order';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { canTransition, assertTransition } from '../config/order-transitions';

let server: http.Server;
let baseUrl: string;

function generateToken(userId: Types.ObjectId, role: string): string {
  return jwt.sign(
    { sub: userId.toString(), role },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  );
}

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    failedCount++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function request(
  method: string,
  path: string,
  token?: string,
  body?: any
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function runTests() {
  console.log('--- Starting Order Transition Tests ---\n');

  // 1. Connect MongoDB
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/shop');
  }

  // 2. Start HTTP Server
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const port = (server.address() as any).port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`Test server running at ${baseUrl}\n`);
      resolve();
    });
  });

  const testSuffix = Date.now().toString();

  // 3. Resolve Category & create Product
  let category = await Category.findOne();
  let createdCategory = false;
  if (!category) {
    category = await Category.create({
      name: `Test Cat ${testSuffix}`,
      slug: `test-cat-${testSuffix}`,
      description: 'Test category description',
      department: new mongoose.Types.ObjectId(),
      image: 'https://example.com/cat.jpg',
    });
    createdCategory = true;
  }

  const product = await Product.create({
    name: `Test Item ${testSuffix}`,
    slug: `test-item-${testSuffix}`,
    description: 'Test product description',
    category: category._id,
    images: ['https://example.com/test.jpg'],
    basePrice: 100,
    status: 'active',
    variants: [
      {
        size: 'M',
        color: 'Black',
        material: 'Cotton',
        sku: `SKU-${testSuffix}`,
        stock: 50,
      },
    ],
  });

  // 4. Create test users with distinct roles (all 6 system roles)
  const [cust1, cust2, staffUser, adminUser, ownerUser, deliveryUser, supplierUser] = await Promise.all([
    User.create({
      name: `Customer One ${testSuffix}`,
      email: `cust1_${testSuffix}@example.com`,
      role: 'customer',
      authProvider: 'local',
      active: true,
      addresses: [{ line1: `123 Main ${testSuffix}`, city: 'BKK', province: 'BKK', postalCode: '10110', country: 'Thailand', isDefault: true }],
    }),
    User.create({
      name: `Customer Two ${testSuffix}`,
      email: `cust2_${testSuffix}@example.com`,
      role: 'customer',
      authProvider: 'local',
      active: true,
      addresses: [{ line1: `456 Side ${testSuffix}`, city: 'BKK', province: 'BKK', postalCode: '10110', country: 'Thailand', isDefault: true }],
    }),
    User.create({
      name: `Staff User ${testSuffix}`,
      email: `staff_${testSuffix}@example.com`,
      role: 'staff',
      authProvider: 'local',
      active: true,
      addresses: [],
    }),
    User.create({
      name: `Admin User ${testSuffix}`,
      email: `admin_${testSuffix}@example.com`,
      role: 'admin',
      authProvider: 'local',
      active: true,
      addresses: [],
    }),
    User.create({
      name: `Owner User ${testSuffix}`,
      email: `owner_${testSuffix}@example.com`,
      role: 'owner',
      authProvider: 'local',
      active: true,
      addresses: [],
    }),
    User.create({
      name: `Delivery User ${testSuffix}`,
      email: `delivery_${testSuffix}@example.com`,
      role: 'delivery_manager',
      authProvider: 'local',
      active: true,
      addresses: [],
    }),
    User.create({
      name: `Supplier User ${testSuffix}`,
      email: `supplier_${testSuffix}@example.com`,
      role: 'supplier',
      authProvider: 'local',
      active: true,
      addresses: [],
    }),
  ]);

  const cust1Token = generateToken(cust1._id, 'customer');
  const cust2Token = generateToken(cust2._id, 'customer');
  const staffToken = generateToken(staffUser._id, 'staff');
  const adminToken = generateToken(adminUser._id, 'admin');
  const ownerToken = generateToken(ownerUser._id, 'owner');
  const deliveryToken = generateToken(deliveryUser._id, 'delivery_manager');
  const supplierToken = generateToken(supplierUser._id, 'supplier');

  const createdOrderIds: Types.ObjectId[] = [];

  const createTestOrder = async (userId: Types.ObjectId, status: any = 'pending_payment'): Promise<IOrder> => {
    const o = await Order.create({
      user: userId,
      items: [
        {
          product: product._id,
          name: product.name,
          image: product.images[0],
          variantSku: product.variants[0].sku,
          size: product.variants[0].size,
          color: product.variants[0].color,
          unitPrice: 100,
          quantity: 2,
        },
      ],
      shippingAddress: {
        line1: `123 Main St ${testSuffix}`,
        city: 'Bangkok',
        province: 'Bangkok',
        postalCode: '10110',
        country: 'Thailand',
      },
      discountAmount: 0,
      subtotal: 200,
      shippingFee: 50,
      total: 250,
      status,
      pointsPaid: 0,
    });
    createdOrderIds.push(o._id as Types.ObjectId);
    return o;
  };

  try {
    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 1: UNIT TESTS ON TRANSITION RULES & GUARDS
    // ══════════════════════════════════════════════════════════════════════════
    console.log('[SECTION 1] Unit Tests: canTransition and assertTransition');

    // Customer canTransition checks
    assert(canTransition('pending_payment', 'cancelled', 'customer', true) === true, 'Customer can cancel own pending order');
    assert(canTransition('pending_payment', 'cancelled', 'customer', false) === false, 'Customer cannot cancel order if not owner');
    assert(canTransition('confirmed', 'cancelled', 'customer', true) === false, 'Customer cannot cancel confirmed order');
    assert(canTransition('confirmed', 'processing', 'customer', true) === false, 'Customer cannot transition confirmed to processing');

    // Customer assertTransition checks
    let custOwnerRule = assertTransition('pending_payment', 'cancelled', 'customer', true);
    assert(custOwnerRule.to === 'cancelled', 'assertTransition returns rule for customer cancelling own order');

    let nonOwnerThrew403 = false;
    try {
      assertTransition('pending_payment', 'cancelled', 'customer', false);
    } catch (e: any) {
      nonOwnerThrew403 = e.statusCode === 403;
    }
    assert(nonOwnerThrew403, 'assertTransition throws 403 for non-owner customer');

    let custConfirmCancelThrew403 = false;
    try {
      assertTransition('confirmed', 'cancelled', 'customer', true);
    } catch (e: any) {
      custConfirmCancelThrew403 = e.statusCode === 403;
    }
    assert(custConfirmCancelThrew403, 'assertTransition throws 403 for customer cancelling confirmed order');

    // Staff assertTransition checks
    let staffRule = assertTransition('confirmed', 'processing', 'staff', false);
    assert(staffRule.to === 'processing', 'Staff can transition confirmed to processing');

    // Admin assertTransition checks
    let adminRule = assertTransition('processing', 'ready_for_dispatch', 'admin', false);
    assert(adminRule.to === 'ready_for_dispatch', 'Admin can transition processing to ready_for_dispatch');

    // Owner assertTransition checks
    let ownerRule = assertTransition('ready_for_dispatch', 'picked_up', 'owner', false);
    assert(ownerRule.to === 'picked_up', 'Owner can transition ready_for_dispatch to picked_up');

    // Delivery Manager assertTransition checks
    let deliveryRule = assertTransition('picked_up', 'in_transit', 'delivery_manager', false);
    assert(deliveryRule.to === 'in_transit', 'Delivery Manager can transition picked_up to in_transit');

    // Supplier assertTransition checks (supplier is never allowed transitions)
    let supplierThrew403 = false;
    try {
      assertTransition('pending_payment', 'cancelled', 'supplier', false);
    } catch (e: any) {
      supplierThrew403 = e.statusCode === 403;
    }
    assert(supplierThrew403, 'assertTransition throws 403 for supplier role');

    console.log('');

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 2: HTTP INTEGRATION TESTS — ROLE: CUSTOMER
    // ══════════════════════════════════════════════════════════════════════════
    console.log('[SECTION 2] HTTP Tests: Role = Customer');

    const cust1Order = await createTestOrder(cust1._id, 'pending_payment');
    const cust2Order = await createTestOrder(cust2._id, 'pending_payment');

    // 2.1 Customer attempting non-cancel transitions must receive 403
    const nonCancelStatuses = ['processing', 'confirmed', 'ready_for_dispatch', 'delivered', 'payment_review', 'pending_payment'];
    for (const targetStatus of nonCancelStatuses) {
      const res = await request('PATCH', `/api/orders/${cust1Order._id}/status`, cust1Token, {
        status: targetStatus,
      });
      assert(res.status === 403, `Customer attempting status '${targetStatus}' is rejected with 403 (got ${res.status})`);
      assert(res.body.success === false, `Response success is false for status '${targetStatus}'`);
    }

    // 2.2 Customer attempting to cancel ANOTHER customer's order must receive 403
    const cancelOtherRes = await request('PATCH', `/api/orders/${cust2Order._id}/status`, cust1Token, {
      status: 'cancelled',
    });
    assert(cancelOtherRes.status === 403, `Customer cancelling another user's order is rejected with 403 (got ${cancelOtherRes.status})`);
    assert(cancelOtherRes.body.success === false, 'cancelOtherRes success is false');

    // 2.3 Customer cancelling their OWN pending_payment order must SUCCEED (200)
    // Also tests that customers cannot inject trackingNumber
    const cancelOwnRes = await request('PATCH', `/api/orders/${cust1Order._id}/status`, cust1Token, {
      status: 'cancelled',
      trackingNumber: 'INJECTED_TRACKING_123',
    });
    assert(cancelOwnRes.status === 200, `Customer cancelling own pending order succeeds with 200 (got ${cancelOwnRes.status})`);
    assert(cancelOwnRes.body.success === true, 'cancelOwnRes success is true');
    assert(cancelOwnRes.body.data.order.status === 'cancelled', "Order status is updated to 'cancelled'");
    assert(
      !cancelOwnRes.body.data.order.trackingNumber || cancelOwnRes.body.data.order.trackingNumber !== 'INJECTED_TRACKING_123',
      'Customer cannot set or inject tracking number on cancelled order'
    );

    // 2.4 Customer attempting to cancel an order already confirmed must receive 403
    const custConfirmedOrder = await createTestOrder(cust1._id, 'confirmed');
    const cancelConfirmedRes = await request('PATCH', `/api/orders/${custConfirmedOrder._id}/status`, cust1Token, {
      status: 'cancelled',
    });
    assert(cancelConfirmedRes.status === 403, `Customer cancelling own confirmed order is rejected with 403 (got ${cancelConfirmedRes.status})`);

    // 2.5 Customer attempting to cancel an order in payment_review must receive 403
    const custPaymentReviewOrder = await createTestOrder(cust1._id, 'payment_review');
    const cancelReviewRes = await request('PATCH', `/api/orders/${custPaymentReviewOrder._id}/status`, cust1Token, {
      status: 'cancelled',
    });
    assert(cancelReviewRes.status === 403, `Customer cancelling own payment_review order is rejected with 403 (got ${cancelReviewRes.status})`);

    console.log('');

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 3: HTTP INTEGRATION TESTS — ROLE: STAFF
    // ══════════════════════════════════════════════════════════════════════════
    console.log('[SECTION 3] HTTP Tests: Role = Staff');

    // 3.1 Staff can transition customer's confirmed order to processing
    const staffTargetOrder1 = await createTestOrder(cust1._id, 'confirmed');
    const staffRes1 = await request('PATCH', `/api/orders/${staffTargetOrder1._id}/status`, staffToken, {
      status: 'processing',
    });
    assert(staffRes1.status === 200, `Staff transition confirmed -> processing succeeds with 200 (got ${staffRes1.status})`);
    assert(staffRes1.body.data.order.status === 'processing', "Order status updated to 'processing'");

    // 3.2 Staff can cancel customer's pending order
    const staffTargetOrder2 = await createTestOrder(cust1._id, 'pending_payment');
    const staffCancelRes = await request('PATCH', `/api/orders/${staffTargetOrder2._id}/status`, staffToken, {
      status: 'cancelled',
    });
    assert(staffCancelRes.status === 200, `Staff cancelling pending order succeeds with 200 (got ${staffCancelRes.status})`);
    assert(staffCancelRes.body.data.order.status === 'cancelled', "Order status updated to 'cancelled'");

    // 3.3 Staff can cancel customer's payment_review order
    const staffReviewOrder = await createTestOrder(cust1._id, 'payment_review');
    const staffCancelReviewRes = await request('PATCH', `/api/orders/${staffReviewOrder._id}/status`, staffToken, {
      status: 'cancelled',
    });
    assert(staffCancelReviewRes.status === 200, `Staff cancelling payment_review order succeeds with 200 (got ${staffCancelReviewRes.status})`);

    // 3.4 Staff illegal transition (delivered -> cancelled) rejected with 400
    const deliveredOrder = await createTestOrder(cust1._id, 'delivered');
    const staffIllegalRes = await request('PATCH', `/api/orders/${deliveredOrder._id}/status`, staffToken, {
      status: 'cancelled',
    });
    assert(staffIllegalRes.status === 400, `Staff illegal transition (delivered -> cancelled) rejected with 400 (got ${staffIllegalRes.status})`);

    console.log('');

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 4: HTTP INTEGRATION TESTS — ROLE: ADMIN
    // ══════════════════════════════════════════════════════════════════════════
    console.log('[SECTION 4] HTTP Tests: Role = Admin');

    // 4.1 Admin can transition processing -> ready_for_dispatch
    const adminTargetOrder = await createTestOrder(cust1._id, 'processing');
    const adminRes = await request('PATCH', `/api/orders/${adminTargetOrder._id}/status`, adminToken, {
      status: 'ready_for_dispatch',
    });
    assert(adminRes.status === 200, `Admin transition processing -> ready_for_dispatch succeeds with 200 (got ${adminRes.status})`);
    assert(adminRes.body.data.order.status === 'ready_for_dispatch', "Order status updated to 'ready_for_dispatch'");

    // 4.2 Admin can transition confirmed -> processing
    const adminConfirmedOrder = await createTestOrder(cust1._id, 'confirmed');
    const adminConfirmRes = await request('PATCH', `/api/orders/${adminConfirmedOrder._id}/status`, adminToken, {
      status: 'processing',
    });
    assert(adminConfirmRes.status === 200, `Admin transition confirmed -> processing succeeds with 200 (got ${adminConfirmRes.status})`);

    // 4.3 Admin can cancel processing order
    const adminCancelOrder = await createTestOrder(cust1._id, 'processing');
    const adminCancelRes = await request('PATCH', `/api/orders/${adminCancelOrder._id}/status`, adminToken, {
      status: 'cancelled',
    });
    assert(adminCancelRes.status === 200, `Admin cancelling processing order succeeds with 200 (got ${adminCancelRes.status})`);

    console.log('');

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 5: HTTP INTEGRATION TESTS — ROLE: OWNER
    // ══════════════════════════════════════════════════════════════════════════
    console.log('[SECTION 5] HTTP Tests: Role = Owner');

    // 5.1 Owner can transition ready_for_dispatch -> picked_up
    const ownerTargetOrder = await createTestOrder(cust1._id, 'ready_for_dispatch');
    const ownerRes = await request('PATCH', `/api/orders/${ownerTargetOrder._id}/status`, ownerToken, {
      status: 'picked_up',
    });
    assert(ownerRes.status === 200, `Owner transition ready_for_dispatch -> picked_up succeeds with 200 (got ${ownerRes.status})`);
    assert(ownerRes.body.data.order.status === 'picked_up', "Order status updated to 'picked_up'");

    // 5.2 Owner can cancel customer's processing order
    const ownerCancelProcessing = await createTestOrder(cust1._id, 'processing');
    const ownerCancelRes = await request('PATCH', `/api/orders/${ownerCancelProcessing._id}/status`, ownerToken, {
      status: 'cancelled',
    });
    assert(ownerCancelRes.status === 200, `Owner cancelling processing order succeeds with 200 (got ${ownerCancelRes.status})`);

    console.log('');

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 6: HTTP INTEGRATION TESTS — ROLE: DELIVERY_MANAGER
    // ══════════════════════════════════════════════════════════════════════════
    console.log('[SECTION 6] HTTP Tests: Role = Delivery Manager');

    // 6.1 Delivery manager can transition picked_up -> in_transit
    const deliveryTargetOrder = await createTestOrder(cust1._id, 'picked_up');
    const deliveryRes = await request('PATCH', `/api/orders/${deliveryTargetOrder._id}/status`, deliveryToken, {
      status: 'in_transit',
    });
    assert(deliveryRes.status === 200, `Delivery Manager transition picked_up -> in_transit succeeds with 200 (got ${deliveryRes.status})`);
    assert(deliveryRes.body.data.order.status === 'in_transit', "Order status updated to 'in_transit'");

    // 6.2 Delivery manager can transition in_transit -> out_for_delivery
    const deliveryRes2 = await request('PATCH', `/api/orders/${deliveryTargetOrder._id}/status`, deliveryToken, {
      status: 'out_for_delivery',
    });
    assert(deliveryRes2.status === 200, `Delivery Manager transition in_transit -> out_for_delivery succeeds with 200 (got ${deliveryRes2.status})`);

    // 6.3 Delivery manager cannot do staff/admin transition (confirmed -> processing)
    const deliveryDeniedOrder = await createTestOrder(cust1._id, 'confirmed');
    const deliveryDeniedRes = await request('PATCH', `/api/orders/${deliveryDeniedOrder._id}/status`, deliveryToken, {
      status: 'processing',
    });
    assert(deliveryDeniedRes.status === 403, `Delivery Manager cannot transition confirmed -> processing (got ${deliveryDeniedRes.status})`);

    // 6.4 Delivery manager cannot cancel pending_payment order
    const deliveryCancelOrder = await createTestOrder(cust1._id, 'pending_payment');
    const deliveryCancelRes = await request('PATCH', `/api/orders/${deliveryCancelOrder._id}/status`, deliveryToken, {
      status: 'cancelled',
    });
    assert(deliveryCancelRes.status === 403, `Delivery Manager cannot cancel order (got ${deliveryCancelRes.status})`);

    console.log('');

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 7: HTTP INTEGRATION TESTS — ROLE: SUPPLIER & UNAUTHENTICATED
    // ══════════════════════════════════════════════════════════════════════════
    console.log('[SECTION 7] HTTP Tests: Role = Supplier & Unauthenticated');

    // 7.1 Supplier cannot access PATCH /api/orders/:orderId/status (rejected by route RBAC)
    const supplierDeniedOrder = await createTestOrder(cust1._id, 'pending_payment');
    const supplierRes = await request('PATCH', `/api/orders/${supplierDeniedOrder._id}/status`, supplierToken, {
      status: 'cancelled',
    });
    assert(supplierRes.status === 403, `Supplier request is rejected with 403 (got ${supplierRes.status})`);

    // 7.2 Unauthenticated request returns 401
    const unauthRes = await request('PATCH', `/api/orders/${cust1Order._id}/status`, undefined, {
      status: 'cancelled',
    });
    assert(unauthRes.status === 401, `Unauthenticated request is rejected with 401 (got ${unauthRes.status})`);

    console.log('');
  } finally {
    // Cleanup created test records
    console.log('Cleaning up test records...');
    if (createdOrderIds.length > 0) {
      await Order.deleteMany({ _id: { $in: createdOrderIds } });
    }
    await Product.deleteOne({ _id: product._id });
    if (createdCategory && category) {
      await Category.deleteOne({ _id: category._id });
    }
    await User.deleteMany({
      _id: { $in: [cust1._id, cust2._id, staffUser._id, adminUser._id, ownerUser._id, deliveryUser._id, supplierUser._id] },
    });

    // Close server and mongo
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
    console.log('Database disconnected and server stopped.');
  }

  console.log(`\n========================================`);
  console.log(`Test Results: ${passedCount} passed, ${failedCount} failed`);
  console.log(`========================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  if (server) server.close();
  mongoose.disconnect();
  process.exit(1);
});
