import { env } from '../config/env';
import mongoose, { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import http from 'http';
import app from '../app';
import User from '../models/User';
import Order from '../models/Order';
import ReturnRequest from '../models/ReturnRequest';
import { Wallet } from '../models/Wallet';
import {
  canReturnTransition,
  assertReturnTransition,
} from '../config/return-transitions';
import { returnService } from '../services/return.service';
import { orderService } from '../services/order.service';

let server: http.Server;
let baseUrl: string;

function generateToken(userId: Types.ObjectId, role: string): string {
  return jwt.sign(
    { sub: userId.toString(), role },
    env.JWT_SECRET,
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
  console.log('\n--- Starting Return Transition & Refund Tests ---\n');

  const mongoUri = env.MONGO_URI;
  await mongoose.connect(mongoUri);

  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      console.log(`Test server running at ${baseUrl}\n`);
      resolve();
    });
  });

  try {
    // ═════════════════════════════════════════════════════════════════════════
    // [SECTION 1] Unit Tests: canReturnTransition and assertReturnTransition
    // ═════════════════════════════════════════════════════════════════════════
    console.log('[SECTION 1] Unit Tests: canReturnTransition & assertReturnTransition');

    // Customer can cancel own requested return
    assert(
      canReturnTransition('requested', 'cancelled', 'customer', true) === true,
      'Customer can cancel own requested return'
    );

    // Customer cannot cancel another user's return
    assert(
      canReturnTransition('requested', 'cancelled', 'customer', false) === false,
      'Customer cannot cancel return if not owner'
    );

    // Customer cannot approve return
    assert(
      canReturnTransition('requested', 'approved', 'customer', true) === false,
      'Customer cannot approve return'
    );

    // Staff can approve return
    assert(
      canReturnTransition('requested', 'approved', 'staff') === true,
      'Staff can approve requested return'
    );

    // Staff can reject return
    assert(
      canReturnTransition('requested', 'rejected', 'staff') === true,
      'Staff can reject requested return'
    );

    // Delivery manager can advance pickup_scheduled -> picked_up
    assert(
      canReturnTransition('pickup_scheduled', 'picked_up', 'delivery_manager') === true,
      'Delivery manager can transition pickup_scheduled -> picked_up'
    );

    // Delivery manager can advance picked_up -> received
    assert(
      canReturnTransition('picked_up', 'received', 'delivery_manager') === true,
      'Delivery manager can transition picked_up -> received'
    );

    // Admin can refund received return
    assert(
      canReturnTransition('received', 'refunded', 'admin') === true,
      'Admin can transition received -> refunded'
    );

    // Admin can refund from refund_processing
    assert(
      canReturnTransition('refund_processing', 'refunded', 'admin') === true,
      'Admin can transition refund_processing -> refunded'
    );

    // Illegal skip: requested -> refunded
    assert(
      canReturnTransition('requested', 'refunded', 'admin') === false,
      'Cannot skip directly from requested -> refunded'
    );

    // Illegal reverse: received -> picked_up
    assert(
      canReturnTransition('received', 'picked_up', 'admin') === false,
      'Cannot reverse received -> picked_up'
    );

    // Terminal branch cannot transition: refunded -> anything
    assert(
      canReturnTransition('refunded', 'requested', 'admin') === false,
      'Cannot transition out of terminal refunded state'
    );

    // Terminal branch cannot transition: rejected -> anything
    assert(
      canReturnTransition('rejected', 'approved', 'admin') === false,
      'Cannot transition out of terminal rejected state'
    );

    // assertReturnTransition throws 400 on illegal transition
    let caught400 = false;
    try {
      assertReturnTransition('requested', 'refunded', 'admin');
    } catch (e: any) {
      caught400 = e.statusCode === 400;
    }
    assert(caught400, 'assertReturnTransition throws 400 for illegal transition');

    // assertReturnTransition throws 403 for unauthorized role
    let caught403 = false;
    try {
      assertReturnTransition('received', 'refunded', 'customer', true);
    } catch (e: any) {
      caught403 = e.statusCode === 403;
    }
    assert(caught403, 'assertReturnTransition throws 403 for customer trying to refund');

    // ═════════════════════════════════════════════════════════════════════════
    // [SECTION 2] Integration & Database Setup
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n[SECTION 2] Integration Setup');

    const customerA = await User.create({
      name: 'Customer A',
      email: `custA_${Date.now()}@larvo.lk`,
      role: 'customer',
      authProvider: 'local',
      active: true,
      addresses: [
        {
          label: 'Home',
          line1: '123 Galle Road',
          city: 'Colombo 03',
          province: 'Western Province',
          postalCode: '00300',
          country: 'Sri Lanka',
          isDefault: true,
        },
      ],
    });

    const customerB = await User.create({
      name: 'Customer B',
      email: `custB_${Date.now()}@larvo.lk`,
      role: 'customer',
      authProvider: 'local',
      active: true,
      addresses: [],
    });

    const adminUser = await User.create({
      name: 'Admin Test',
      email: `admin_${Date.now()}@larvo.lk`,
      role: 'admin',
      authProvider: 'local',
      active: true,
    });

    const tokenA = generateToken(customerA._id, 'customer');
    const tokenB = generateToken(customerB._id, 'customer');
    const tokenAdmin = generateToken(adminUser._id, 'admin');

    const testOrder = await Order.create({
      user: customerA._id,
      items: [
        {
          product: new Types.ObjectId(),
          name: 'Silk Linen Shirt',
          image: 'https://example.com/shirt.jpg',
          variantSku: 'SLS-M-BLU',
          size: 'M',
          color: 'Blue',
          unitPrice: 5000,
          quantity: 1,
          lineTotal: 5000,
        },
      ],
      shippingAddress: {
        label: 'Home',
        line1: '123 Galle Road',
        city: 'Colombo 03',
        province: 'Western Province',
        postalCode: '00300',
        country: 'Sri Lanka',
      },
      subtotal: 5000,
      shippingFee: 0,
      total: 5000,
      status: 'delivered',
      deliveredAt: new Date(),
    });

    // ═════════════════════════════════════════════════════════════════════════
    // [SECTION 3] Return Creation & Ownership in GET /api/orders/:id
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n[SECTION 3] Return Request Creation & GET /api/orders/:id');

    const returnRequest = await returnService.createReturnRequest(
      customerA._id,
      {
        orderId: testOrder._id.toString(),
        items: [
          {
            orderItemRef: 0,
            qty: 1,
            reason: 'Size does not fit comfortably',
          },
        ],
      }
    );

    assert(returnRequest.status === 'requested', 'Return status is requested');
    assert(returnRequest.statusHistory.length === 1, 'Initial statusHistory entry created');
    assert(returnRequest.statusHistory[0].status === 'requested', 'statusHistory contains requested');

    // Customer A gets own order: returnRequest DTO is populated
    const getOrderResA = await request('GET', `/api/orders/${testOrder._id}`, tokenA);
    assert(getOrderResA.status === 200, 'Customer A can fetch their order (200)');
    assert(getOrderResA.body.success === true, 'Response success is true');
    assert(Boolean(getOrderResA.body.data.order.returnRequest), 'Order contains returnRequest DTO');
    assert(getOrderResA.body.data.order.returnRequest.status === 'requested', 'returnRequest status is requested');
    assert(
      getOrderResA.body.data.order.returnRequest.items[0].productName === 'Silk Linen Shirt',
      'returnRequest includes product details'
    );
    assert(
      Boolean(getOrderResA.body.data.order.returnRequest.pickup?.address),
      'returnRequest pickup address is populated'
    );

    // Customer B requests Customer A's order: 403 Forbidden
    const getOrderResB = await request('GET', `/api/orders/${testOrder._id}`, tokenB);
    assert(getOrderResB.status === 403, 'Customer B cannot access Customer A order (403)');

    // ═════════════════════════════════════════════════════════════════════════
    // [SECTION 4] Lifecycle Progression & Decision
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n[SECTION 4] Lifecycle Progression & Transitions');

    // Staff approves return
    const approvedReturn = await returnService.processReturnDecision(
      returnRequest._id.toString(),
      { decision: 'approved' }
    );
    assert(approvedReturn.status === 'pickup_scheduled', 'Approved return transitioned to pickup_scheduled');
    assert(approvedReturn.refundAmount === 5000, 'Refund amount computed in LKR');
    assert(approvedReturn.statusHistory.length === 3, 'statusHistory has requested -> approved -> pickup_scheduled');

    // Courier picks up parcel
    const pickedUpReturn = await returnService.advanceReturnPickupStatus(
      returnRequest._id.toString(),
      'picked_up'
    );
    assert(pickedUpReturn.status === 'picked_up', 'Return advanced to picked_up');
    assert(pickedUpReturn.statusHistory.length === 4, 'statusHistory updated with picked_up');

    // Warehouse receives parcel for inspection
    const receivedReturn = await returnService.advanceReturnPickupStatus(
      returnRequest._id.toString(),
      'received'
    );
    assert(receivedReturn.status === 'received', 'Return advanced to received');
    assert(receivedReturn.statusHistory.length === 5, 'statusHistory updated with received');

    // ═════════════════════════════════════════════════════════════════════════
    // [SECTION 5] Refund & Idempotency
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n[SECTION 5] Refund Execution & Idempotency');

    const walletBefore = await Wallet.findOne({ user: customerA._id });
    const balanceBefore = walletBefore?.balancePoints || 0;

    // First refund call
    const refunded1 = await returnService.processRefund(
      returnRequest._id.toString(),
      adminUser._id
    );
    assert(refunded1.status === 'refunded', 'Return status changed to refunded');
    assert(Boolean(refunded1.refundedAt), 'refundedAt timestamp is recorded');

    const walletAfter1 = await Wallet.findOne({ user: customerA._id });
    const balanceAfter1 = walletAfter1?.balancePoints || 0;
    assert(balanceAfter1 > balanceBefore, 'Wallet balance credited on first refund call');

    // Second refund call (idempotency verification)
    const refunded2 = await returnService.processRefund(
      returnRequest._id.toString(),
      adminUser._id
    );
    assert(refunded2.status === 'refunded', 'Second refund call returns refunded return document');

    const walletAfter2 = await Wallet.findOne({ user: customerA._id });
    const balanceAfter2 = walletAfter2?.balancePoints || 0;
    assert(balanceAfter2 === balanceAfter1, 'Wallet balance NOT double-credited on repeated call');

    // ═════════════════════════════════════════════════════════════════════════
    // [SECTION 6] Terminal Branches & Failure Scenarios
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n[SECTION 6] Terminal Branches (Rejected, Inspection Failed, Cancelled)');

    // Test Order 2 for Rejection flow
    const testOrder2 = await Order.create({
      user: customerA._id,
      items: [
        {
          product: new Types.ObjectId(),
          name: 'Silk Linen Shirt',
          image: 'https://example.com/shirt.jpg',
          variantSku: 'SLS-M-BLU',
          size: 'M',
          color: 'Blue',
          unitPrice: 5000,
          quantity: 1,
          lineTotal: 5000,
        },
      ],
      shippingAddress: {
        label: 'Home',
        line1: '123 Galle Road',
        city: 'Colombo 03',
        province: 'Western Province',
        postalCode: '00300',
        country: 'Sri Lanka',
      },
      subtotal: 5000,
      shippingFee: 0,
      total: 5000,
      status: 'delivered',
      deliveredAt: new Date(),
    });

    const returnReqReject = await returnService.createReturnRequest(
      customerA._id,
      {
        orderId: testOrder2._id.toString(),
        items: [{ orderItemRef: 0, qty: 1, reason: 'Size too small' }],
      }
    );

    const rejectedReturn = await returnService.processReturnDecision(
      returnReqReject._id.toString(),
      { decision: 'rejected', rejectionReason: 'Item condition not eligible for return' }
    );
    assert(rejectedReturn.status === 'rejected', 'Return status changed to rejected');
    assert(
      rejectedReturn.rejectionReason === 'Item condition not eligible for return',
      'Rejection reason recorded on return document'
    );
    assert(
      rejectedReturn.statusHistory.slice(-1)[0].status === 'rejected',
      'statusHistory contains rejected entry'
    );

    // Verify GET /api/orders/:id returns rejectionReason in returnRequest DTO
    const getOrderResReject = await request('GET', `/api/orders/${testOrder2._id}`, tokenA);
    assert(
      getOrderResReject.body.data.order.returnRequest.status === 'rejected',
      'Order returnRequest status is rejected'
    );
    assert(
      getOrderResReject.body.data.order.returnRequest.rejectionReason ===
        'Item condition not eligible for return',
      'Order returnRequest DTO includes rejectionReason'
    );

    // Test Order 3 for Inspection Failed flow
    const testOrder3 = await Order.create({
      user: customerA._id,
      items: [
        {
          product: new Types.ObjectId(),
          name: 'Cotton T-Shirt',
          image: 'https://example.com/tee.jpg',
          variantSku: 'CTS-L-BLK',
          size: 'L',
          color: 'Black',
          unitPrice: 3000,
          quantity: 1,
          lineTotal: 3000,
        },
      ],
      shippingAddress: {
        label: 'Home',
        line1: '123 Galle Road',
        city: 'Colombo 03',
        province: 'Western Province',
        postalCode: '00300',
        country: 'Sri Lanka',
      },
      subtotal: 3000,
      shippingFee: 0,
      total: 3000,
      status: 'delivered',
      deliveredAt: new Date(),
    });

    const returnReqInspect = await returnService.createReturnRequest(
      customerA._id,
      {
        orderId: testOrder3._id.toString(),
        items: [{ orderItemRef: 0, qty: 1, reason: 'Defective stitching' }],
      }
    );

    await returnService.processReturnDecision(returnReqInspect._id.toString(), {
      decision: 'approved',
    });
    await returnService.advanceReturnPickupStatus(returnReqInspect._id.toString(), 'picked_up');
    await returnService.advanceReturnPickupStatus(returnReqInspect._id.toString(), 'received');

    // Inspection failed transition by staff
    const inspectFailedReturn = await returnService.transitionReturnStatus(
      returnReqInspect._id.toString(),
      'inspection_failed',
      { userId: adminUser._id, role: 'staff' },
      {
        rejectionReason: 'Item showed signs of wear and tear, failing quality check',
        note: 'Quality inspection failed at warehouse depot',
      }
    );
    assert(
      inspectFailedReturn.status === 'inspection_failed',
      'Return status transitioned to inspection_failed'
    );
    assert(
      inspectFailedReturn.statusHistory.slice(-1)[0].status === 'inspection_failed',
      'statusHistory includes inspection_failed'
    );

    // Verify GET /api/orders/:id returns inspection_failed status & reason
    const getOrderResInspect = await request('GET', `/api/orders/${testOrder3._id}`, tokenA);
    assert(
      getOrderResInspect.body.data.order.returnRequest.status === 'inspection_failed',
      'Order returnRequest status is inspection_failed'
    );
    assert(
      getOrderResInspect.body.data.order.returnRequest.rejectionReason ===
        'Item showed signs of wear and tear, failing quality check',
      'Order returnRequest DTO includes inspection failure reason'
    );

    // Test Order 4 for Customer Self-Cancellation flow
    const testOrder4 = await Order.create({
      user: customerA._id,
      items: [
        {
          product: new Types.ObjectId(),
          name: 'Classic Chinos',
          image: 'https://example.com/chinos.jpg',
          variantSku: 'CC-32-KHK',
          size: '32',
          color: 'Khaki',
          unitPrice: 4500,
          quantity: 1,
          lineTotal: 4500,
        },
      ],
      shippingAddress: {
        label: 'Home',
        line1: '123 Galle Road',
        city: 'Colombo 03',
        province: 'Western Province',
        postalCode: '00300',
        country: 'Sri Lanka',
      },
      subtotal: 4500,
      shippingFee: 0,
      total: 4500,
      status: 'delivered',
      deliveredAt: new Date(),
    });

    const returnReqCancel = await returnService.createReturnRequest(
      customerA._id,
      {
        orderId: testOrder4._id.toString(),
        items: [{ orderItemRef: 0, qty: 1, reason: 'Changed my mind' }],
      }
    );

    // Customer B attempts to cancel Customer A's return -> rejected
    let cancelForbidden = false;
    try {
      await returnService.transitionReturnStatus(
        returnReqCancel._id.toString(),
        'cancelled',
        { userId: customerB._id, role: 'customer' }
      );
    } catch (e: any) {
      cancelForbidden = e.statusCode === 403;
    }
    assert(cancelForbidden, 'Customer B cannot cancel Customer A return (403)');

    // Customer A cancels own return -> succeeds
    const cancelledReturn = await returnService.transitionReturnStatus(
      returnReqCancel._id.toString(),
      'cancelled',
      { userId: customerA._id, role: 'customer' },
      { note: 'Customer decided to keep the item' }
    );
    assert(cancelledReturn.status === 'cancelled', 'Return status changed to cancelled');
    assert(
      cancelledReturn.statusHistory.slice(-1)[0].status === 'cancelled',
      'statusHistory includes cancelled'
    );

    // Cannot transition from terminal cancelled to anything
    let terminalExitRejected = false;
    try {
      await returnService.transitionReturnStatus(
        returnReqCancel._id.toString(),
        'requested',
        { userId: customerA._id, role: 'customer' }
      );
    } catch (e: any) {
      terminalExitRejected = e.statusCode === 400;
    }
    assert(terminalExitRejected, 'Cannot transition out of terminal cancelled state (400)');

    // Clean up
    console.log('\nCleaning up test records...');
    await ReturnRequest.deleteMany({
      order: { $in: [testOrder._id, testOrder2._id, testOrder3._id, testOrder4._id] },
    });
    await Order.deleteMany({
      _id: { $in: [testOrder._id, testOrder2._id, testOrder3._id, testOrder4._id] },
    });
    await Wallet.deleteMany({ user: customerA._id });
    await User.deleteMany({ _id: { $in: [customerA._id, customerB._id, adminUser._id] } });

    console.log(`\n========================================`);
    console.log(`Test Results: ${passedCount} passed, ${failedCount} failed`);
    console.log(`========================================\n`);
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
