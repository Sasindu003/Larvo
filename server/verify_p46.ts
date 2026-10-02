import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { User } from './src/models/User';
import { Order, OrderStatus } from './src/models/Order';
import { Payment } from './src/models/Payment';
import { Product } from './src/models/Product';
import {
  canTransition,
  assertTransition,
  getTransitionRule,
  ORDER_TRANSITIONS,
} from './src/config/order-transitions';

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
  console.log('  RUNNING P46 ORDER STATUS TRANSITION TEST SUITE    ');
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
    // ══════════════════════════════════════════════════════════════════════
    // PART 1: Unit / Rule Verification for canTransition & assertTransition
    // ══════════════════════════════════════════════════════════════════════
    console.log('--- PART 1: Transition Map Rule Table Assertions ---');

    // 1. Customer rules
    assert(
      canTransition('pending_payment', 'payment_review', 'customer', true) === true,
      'Customer can transition pending_payment -> payment_review on owned order'
    );
    assert(
      canTransition('pending_payment', 'payment_review', 'customer', false) === false,
      'Customer CANNOT transition pending_payment -> payment_review on unowned order'
    );
    assert(
      canTransition('pending_payment', 'confirmed', 'customer', true) === true,
      'Customer can transition pending_payment -> confirmed on owned order (via payment)'
    );
    assert(
      canTransition('pending_payment', 'cancelled', 'customer', true) === true,
      'Customer can self-cancel pending_payment on owned order'
    );
    assert(
      canTransition('pending_payment', 'cancelled', 'customer', false) === false,
      'Customer CANNOT self-cancel unowned order'
    );
    assert(
      canTransition('confirmed', 'cancelled', 'customer', true) === false,
      'Customer CANNOT cancel confirmed order (requires staff+)'
    );
    assert(
      canTransition('processing', 'ready_for_dispatch', 'customer', true) === false,
      'Customer CANNOT advance fulfillment'
    );
    assert(
      canTransition('ready_for_dispatch', 'picked_up', 'customer', true) === false,
      'Customer CANNOT advance delivery'
    );

    // 2. Staff rules
    assert(
      canTransition('payment_review', 'pending_payment', 'staff') === true,
      'Staff can reject payment slip: payment_review -> pending_payment'
    );
    assert(
      canTransition('payment_review', 'confirmed', 'staff') === true,
      'Staff can approve payment slip: payment_review -> confirmed'
    );
    assert(
      canTransition('payment_review', 'cancelled', 'staff') === true,
      'Staff can cancel during payment_review'
    );
    assert(
      canTransition('confirmed', 'processing', 'staff') === true,
      'Staff can move confirmed -> processing'
    );
    assert(
      canTransition('processing', 'ready_for_dispatch', 'staff') === true,
      'Staff can move processing -> ready_for_dispatch'
    );
    assert(
      canTransition('ready_for_dispatch', 'picked_up', 'staff') === false,
      'Staff CANNOT advance delivery: ready_for_dispatch -> picked_up'
    );

    // 3. Delivery Manager rules
    assert(
      canTransition('ready_for_dispatch', 'picked_up', 'delivery_manager') === true,
      'Delivery manager can advance ready_for_dispatch -> picked_up'
    );
    assert(
      canTransition('picked_up', 'in_transit', 'delivery_manager') === true,
      'Delivery manager can advance picked_up -> in_transit'
    );
    assert(
      canTransition('in_transit', 'out_for_delivery', 'delivery_manager') === true,
      'Delivery manager can advance in_transit -> out_for_delivery'
    );
    assert(
      canTransition('out_for_delivery', 'delivered', 'delivery_manager') === true,
      'Delivery manager can advance out_for_delivery -> delivered'
    );
    assert(
      canTransition('confirmed', 'processing', 'delivery_manager') === false,
      'Delivery manager CANNOT advance fulfillment: confirmed -> processing'
    );
    assert(
      canTransition('payment_review', 'confirmed', 'delivery_manager') === false,
      'Delivery manager CANNOT approve payment slips'
    );
    assert(
      canTransition('pending_payment', 'cancelled', 'delivery_manager') === false,
      'Delivery manager CANNOT cancel orders'
    );

    // 4. Terminal states & illegal pairs
    assert(
      canTransition('delivered', 'processing') === false,
      'Terminal state: delivered has no outbound transitions'
    );
    assert(
      canTransition('cancelled', 'confirmed') === false,
      'Terminal state: cancelled has no outbound transitions'
    );
    assert(
      canTransition('confirmed', 'pending_payment') === false,
      'Illegal transition: confirmed -> pending_payment is not allowed'
    );
    assert(
      canTransition('pending_payment', 'delivered') === false,
      'Illegal transition: pending_payment -> delivered skips phases'
    );

    // 5. assertTransition throws AppError with appropriate status codes
    let threw400 = false;
    try {
      assertTransition('delivered', 'processing', 'admin');
    } catch (err: any) {
      if (err.statusCode === 400 && err.message.includes('Cannot transition order status')) {
        threw400 = true;
      }
    }
    assert(threw400, 'assertTransition throws AppError 400 naming invalid pair on illegal transition');

    let threw403Role = false;
    try {
      assertTransition('ready_for_dispatch', 'picked_up', 'staff');
    } catch (err: any) {
      if (err.statusCode === 403 && err.message.includes('is not authorized')) {
        threw403Role = true;
      }
    }
    assert(threw403Role, 'assertTransition throws AppError 403 on unauthorized role');

    let threw403Ownership = false;
    try {
      assertTransition('pending_payment', 'cancelled', 'customer', false);
    } catch (err: any) {
      if (err.statusCode === 403 && err.message.includes('access')) {
        threw403Ownership = true;
      }
    }
    assert(threw403Ownership, 'assertTransition throws AppError 403 on non-owner customer cancel');

    console.log('\n--- PART 2: End-to-End HTTP Endpoint Verification ---');

    // ══════════════════════════════════════════════════════════════════════
    // PART 2: Integration / HTTP endpoint verification
    // ══════════════════════════════════════════════════════════════════════

    // Setup Test Users
    const customerA = await User.findOneAndUpdate(
      { email: 'p46_custA@demo.com' },
      {
        $set: {
          name: 'P46 Customer A',
          role: 'customer',
          status: 'active',
          passwordHash: '$2a$10$abcdefghijklmnopqrstuu',
        },
      },
      { upsert: true, new: true }
    );

    const customerB = await User.findOneAndUpdate(
      { email: 'p46_custB@demo.com' },
      {
        $set: {
          name: 'P46 Customer B',
          role: 'customer',
          status: 'active',
          passwordHash: '$2a$10$abcdefghijklmnopqrstuu',
        },
      },
      { upsert: true, new: true }
    );

    const staffUser = await User.findOneAndUpdate(
      { email: 'p46_staff@demo.com' },
      {
        $set: {
          name: 'P46 Staff Reviewer',
          role: 'staff',
          status: 'active',
          passwordHash: '$2a$10$abcdefghijklmnopqrstuu',
        },
      },
      { upsert: true, new: true }
    );

    const deliveryUser = await User.findOneAndUpdate(
      { email: 'p46_delivery@demo.com' },
      {
        $set: {
          name: 'P46 Delivery Courier',
          role: 'delivery_manager',
          status: 'active',
          passwordHash: '$2a$10$abcdefghijklmnopqrstuu',
        },
      },
      { upsert: true, new: true }
    );

    const cookieCustA = makeAuthCookie(customerA._id.toString());
    const cookieCustB = makeAuthCookie(customerB._id.toString());
    const cookieStaff = makeAuthCookie(staffUser._id.toString());
    const cookieDelivery = makeAuthCookie(deliveryUser._id.toString());

    // Setup a Test Product for stock checks
    const testProduct = await Product.findOneAndUpdate(
      { slug: 'p46-test-jacket' },
      {
        $set: {
          name: 'P46 Transition Test Jacket',
          slug: 'p46-test-jacket',
          basePrice: 3500,
          status: 'active',
          images: ['/uploads/products/jacket.jpg'],
          variants: [
            {
              sku: 'SKU-P46-JKT-BLK-M',
              size: 'M',
              color: 'Black',
              stock: 20,
            },
          ],
        },
      },
      { upsert: true, new: true }
    );

    async function createOrderHelper(userId: mongoose.Types.ObjectId, initialStatus: OrderStatus = 'pending_payment') {
      return await Order.create({
        user: userId,
        items: [
          {
            product: testProduct._id,
            variantSku: 'SKU-P46-JKT-BLK-M',
            name: testProduct.name,
            image: testProduct.images[0],
            size: 'M',
            color: 'Black',
            unitPrice: 3500,
            quantity: 2,
          },
        ],
        shippingAddress: {
          line1: '100 Test St',
          city: 'Dhaka',
          province: 'Dhaka',
          postalCode: '1212',
          country: 'Bangladesh',
        },
        subtotal: 7000,
        shippingFee: 0,
        discountAmount: 0,
        total: 7000,
        status: initialStatus,
        pointsPaid: 0,
      });
    }

    // ── Test Flow A: Customer Self-Cancel & Ownership ──
    const order1 = await createOrderHelper(customerA._id, 'pending_payment');

    // Customer B tries to cancel Customer A's order -> 403
    const cancelResB = await jsonRequest(
      'PATCH',
      `/api/orders/${order1._id}/status`,
      { status: 'cancelled' },
      cookieCustB
    );
    assert(
      cancelResB.status === 403,
      `Customer B attempting to cancel Customer A's order returns 403 (got ${cancelResB.status})`
    );

    // Customer A tries to set status to 'confirmed' directly -> 403
    const cheatResA = await jsonRequest(
      'PATCH',
      `/api/orders/${order1._id}/status`,
      { status: 'confirmed' },
      cookieCustA
    );
    assert(
      cheatResA.status === 403,
      `Customer A attempting to directly confirm order via PATCH returns 403 (got ${cheatResA.status})`
    );

    // Record product stock before cancellation
    const prodBefore = await Product.findById(testProduct._id);
    const stockBefore = prodBefore?.variants[0].stock ?? 0;

    // Customer A cancels own order -> 200
    const cancelResA = await jsonRequest(
      'PATCH',
      `/api/orders/${order1._id}/status`,
      { status: 'cancelled' },
      cookieCustA
    );
    assert(
      cancelResA.status === 200 && cancelResA.body.data?.order?.status === 'cancelled',
      `Customer A can self-cancel own pending order -> 200 OK (status: ${cancelResA.body.data?.order?.status})`
    );

    // Verify stock restocked by 2
    const prodAfter = await Product.findById(testProduct._id);
    const stockAfter = prodAfter?.variants[0].stock ?? 0;
    assert(
      stockAfter === stockBefore + 2,
      `Cancellation restocks inventory: stock was ${stockBefore}, now ${stockAfter}`
    );

    // Attempting to transition already cancelled order -> 400
    const retryRes = await jsonRequest(
      'PATCH',
      `/api/orders/${order1._id}/status`,
      { status: 'pending_payment' },
      cookieStaff
    );
    assert(
      retryRes.status === 400,
      `Terminal state guard: attempting to transition cancelled order returns 400 (got ${retryRes.status})`
    );

    // ── Test Flow B: Staff Payment Slip Review Cycle ──
    const order2 = await createOrderHelper(customerA._id, 'payment_review');
    await Payment.findOneAndUpdate(
      { order: order2._id },
      {
        $set: {
          order: order2._id,
          method: 'bank_transfer',
          status: 'submitted',
          slipImageUrl: '/uploads/payment-slips/test_slip.png',
          amount: 7000,
        },
      },
      { upsert: true }
    );

    // Staff rejects slip: payment_review -> pending_payment
    const rejectRes = await jsonRequest(
      'PATCH',
      `/api/orders/${order2._id}/status`,
      { status: 'pending_payment' },
      cookieStaff
    );
    assert(
      rejectRes.status === 200 && rejectRes.body.data?.order?.status === 'pending_payment',
      `Staff rejection bounces order: payment_review -> pending_payment (got status ${rejectRes.body.data?.order?.status})`
    );

    // Verify Payment document is updated to 'rejected'
    const rejectedPayment = await Payment.findOne({ order: order2._id });
    assert(
      rejectedPayment?.status === 'rejected' && rejectedPayment.reviewedBy?.toString() === staffUser._id.toString(),
      `Payment status updated to 'rejected' and reviewedBy stamped with staff user ID`
    );

    // Re-simulate slip submission -> payment_review
    await Order.findByIdAndUpdate(order2._id, { status: 'payment_review' });
    await Payment.findOneAndUpdate({ order: order2._id }, { $set: { status: 'submitted' } });

    // Staff approves slip: payment_review -> confirmed
    const approveRes = await jsonRequest(
      'PATCH',
      `/api/orders/${order2._id}/status`,
      { status: 'confirmed' },
      cookieStaff
    );
    assert(
      approveRes.status === 200 && approveRes.body.data?.order?.status === 'confirmed',
      `Staff approval advances order: payment_review -> confirmed (got status ${approveRes.body.data?.order?.status})`
    );

    const approvedPayment = await Payment.findOne({ order: order2._id });
    assert(
      approvedPayment?.status === 'approved' && approvedPayment.reviewedBy?.toString() === staffUser._id.toString(),
      `Payment status updated to 'approved' and reviewedBy stamped with staff user ID`
    );

    // ── Test Flow C: Fulfillment & Delivery Phase Lifecycle ──
    // Staff moves confirmed -> processing
    const procRes = await jsonRequest(
      'PATCH',
      `/api/orders/${order2._id}/status`,
      { status: 'processing' },
      cookieStaff
    );
    assert(
      procRes.status === 200 && procRes.body.data?.order?.status === 'processing',
      `Staff advances confirmed -> processing -> 200 OK`
    );

    // Staff moves processing -> ready_for_dispatch
    const readyRes = await jsonRequest(
      'PATCH',
      `/api/orders/${order2._id}/status`,
      { status: 'ready_for_dispatch' },
      cookieStaff
    );
    assert(
      readyRes.status === 200 && readyRes.body.data?.order?.status === 'ready_for_dispatch',
      `Staff advances processing -> ready_for_dispatch -> 200 OK`
    );

    // Staff tries ready_for_dispatch -> picked_up -> 403 Forbidden!
    const staffPickupRes = await jsonRequest(
      'PATCH',
      `/api/orders/${order2._id}/status`,
      { status: 'picked_up' },
      cookieStaff
    );
    assert(
      staffPickupRes.status === 403,
      `Staff CANNOT advance to picked_up (returns 403, got ${staffPickupRes.status})`
    );

    // Delivery Manager picks up with trackingNumber
    const pickupRes = await jsonRequest(
      'PATCH',
      `/api/orders/${order2._id}/status`,
      { status: 'picked_up', trackingNumber: 'TRK-BD-883311' },
      cookieDelivery
    );
    assert(
      pickupRes.status === 200 &&
        pickupRes.body.data?.order?.status === 'picked_up' &&
        pickupRes.body.data?.order?.trackingNumber === 'TRK-BD-883311',
      `Delivery manager advances ready_for_dispatch -> picked_up with trackingNumber -> 200 OK`
    );

    // Delivery Manager advances picked_up -> in_transit
    const inTransitRes = await jsonRequest(
      'PATCH',
      `/api/orders/${order2._id}/status`,
      { status: 'in_transit' },
      cookieDelivery
    );
    assert(
      inTransitRes.status === 200 && inTransitRes.body.data?.order?.status === 'in_transit',
      `Delivery manager advances picked_up -> in_transit -> 200 OK`
    );

    // Delivery Manager advances in_transit -> out_for_delivery
    const outForDelRes = await jsonRequest(
      'PATCH',
      `/api/orders/${order2._id}/status`,
      { status: 'out_for_delivery' },
      cookieDelivery
    );
    assert(
      outForDelRes.status === 200 && outForDelRes.body.data?.order?.status === 'out_for_delivery',
      `Delivery manager advances in_transit -> out_for_delivery -> 200 OK`
    );

    // Delivery Manager advances out_for_delivery -> delivered
    const deliveredRes = await jsonRequest(
      'PATCH',
      `/api/orders/${order2._id}/status`,
      { status: 'delivered' },
      cookieDelivery
    );
    assert(
      deliveredRes.status === 200 &&
        deliveredRes.body.data?.order?.status === 'delivered' &&
        !!deliveredRes.body.data?.order?.deliveredAt,
      `Delivery manager advances out_for_delivery -> delivered -> 200 OK with deliveredAt stamped`
    );

    // Attempting to move from delivered -> in_transit -> 400
    const postDeliveredRes = await jsonRequest(
      'PATCH',
      `/api/orders/${order2._id}/status`,
      { status: 'in_transit' },
      cookieDelivery
    );
    assert(
      postDeliveredRes.status === 400,
      `Terminal state guard: attempting to transition delivered order returns 400 (got ${postDeliveredRes.status})`
    );

  } catch (error) {
    console.error('Test execution error:', error);
    failed++;
  } finally {
    await mongoose.disconnect();
    console.log('\n====================================================');
    console.log(`P46 TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');
    if (failed > 0) {
      process.exit(1);
    }
  }
}

run();
