import http from 'http';
import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import app from './src/app';
import { User } from './src/models/User';
import { Order } from './src/models/Order';
import { Payment } from './src/models/Payment';
import { Product } from './src/models/Product';
import { Wallet } from './src/models/Wallet';
import { Invoice, deriveInvoiceNumber } from './src/models/Invoice';
import { orderService } from './src/services/order.service';
import { invoiceService } from './src/services/invoice.service';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_1234567890_super_secret';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shop';

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
    const payload = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload).toString(),
    };
    if (cookie) headers['Cookie'] = cookie;

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
  console.log('  P51 Invoice Generation Test Suite     ');
  console.log('========================================\n');

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB at', MONGODB_URI);

  // Start test HTTP server on an ephemeral port
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      serverPort = (server.address() as any).port;
      console.log(`Ephemeral test server listening on port ${serverPort}`);
      resolve();
    });
  });

  try {
    // 1. Setup / identify test users
    const customerUser = await User.findOneAndUpdate(
      { email: 'p51_customer@test.com' },
      {
        name: 'P51 Customer',
        email: 'p51_customer@test.com',
        passwordHash: 'dummy',
        role: 'customer',
        active: true,
        addresses: [
          {
            label: 'Home',
            line1: '100 Galle Road',
            city: 'Colombo 03',
            province: 'Western',
            postalCode: '00300',
            country: 'Sri Lanka',
            isDefault: true,
          },
        ],
      },
      { upsert: true, new: true }
    );

    const otherCustomer = await User.findOneAndUpdate(
      { email: 'p51_other@test.com' },
      {
        name: 'P51 Other Customer',
        email: 'p51_other@test.com',
        passwordHash: 'dummy',
        role: 'customer',
        active: true,
        addresses: [
          {
            label: 'Home',
            line1: '200 Kandy Road',
            city: 'Kandy',
            province: 'Central',
            postalCode: '20000',
            country: 'Sri Lanka',
            isDefault: true,
          },
        ],
      },
      { upsert: true, new: true }
    );

    const staffUser = await User.findOneAndUpdate(
      { email: 'p51_staff@test.com' },
      {
        name: 'P51 Staff',
        email: 'p51_staff@test.com',
        passwordHash: 'dummy',
        role: 'staff',
        active: true,
      },
      { upsert: true, new: true }
    );

    const customerCookie = makeAuthCookie(customerUser._id.toString());
    const otherCustomerCookie = makeAuthCookie(otherCustomer._id.toString());
    const staffCookie = makeAuthCookie(staffUser._id.toString());

    // Setup test product
    const product = await Product.findOneAndUpdate(
      { slug: 'p51-test-item' },
      {
        name: 'P51 Linen Shirt',
        slug: 'p51-test-item',
        description: 'Invoice test product',
        basePrice: 2500,
        status: 'active',
        images: ['/uploads/products/p51.jpg'],
        variants: [
          {
            sku: 'P51-VAR-01',
            size: 'M',
            color: 'White',
            stock: 500,
            price: 2500,
          },
        ],
      },
      { upsert: true, new: true }
    );

    console.log('\n--- Test 1: Deterministic Invoice Number Generation ---');
    const dummyId = new Types.ObjectId('65f123456789abcdef012345');
    const invNum = deriveInvoiceNumber(dummyId);
    assert(
      invNum === 'INV-EF012345',
      'deriveInvoiceNumber generates INV- prefix + last 8 hex chars uppercase',
      `Got ${invNum}`
    );

    console.log('\n--- Test 2: Hook 1 - Reward Points Payment Confirmation ---');
    // Ensure customer has enough wallet points (e.g. 5000 points)
    await Wallet.findOneAndUpdate(
      { user: customerUser._id },
      {
        $set: {
          balancePoints: 10000000,
          lifetimeEarnedPoints: 10000000,
          lifetimeSpentPoints: 0,
          active: true,
        },
      },
      { upsert: true, new: true }
    );

    // Create an order
    const addressId = customerUser.addresses[0]._id!.toString();
    const orderRes1 = await orderService.createOrder(customerUser._id, {
      items: [{ productId: product._id.toString(), variantSku: 'P51-VAR-01', quantity: 2 }],
      shippingAddressId: addressId,
    });
    const order1 = orderRes1.order;

    // Clean any prior invoice for order1
    await Invoice.deleteMany({ order: order1._id });

    // Pay with wallet reward points -> transitions to confirmed
    const walletPayRes = await orderService.payWithWallet(customerUser._id, order1._id.toString());
    assert(walletPayRes.order.status === 'confirmed', 'Order transitioned to confirmed via wallet payment');

    // Verify invoice created
    const invoice1 = await Invoice.findOne({ order: order1._id });
    assert(!!invoice1, 'Invoice document automatically created in MongoDB');
    assert(
      invoice1?.invoiceNumber === deriveInvoiceNumber(order1._id),
      'Invoice number matches deterministic formula',
      `Got ${invoice1?.invoiceNumber}`
    );
    assert(
      invoice1?.snapshot.paymentMethod === 'reward_points',
      'Invoice snapshot paymentMethod is reward_points',
      `Got ${invoice1?.snapshot.paymentMethod}`
    );
    assert(
      invoice1?.snapshot.pointsUsed === walletPayRes.pointsDeducted,
      'Invoice snapshot preserves pointsUsed matching reward points deducted',
      `Got pointsUsed: ${invoice1?.snapshot.pointsUsed}, deducted: ${walletPayRes.pointsDeducted}`
    );
    assert(
      invoice1?.snapshot.items.length === 1 && invoice1.snapshot.items[0].quantity === 2,
      'Invoice snapshot captures order items accurately'
    );
    assert(
      invoice1?.snapshot.shippingAddress.line1 === '100 Galle Road',
      'Invoice snapshot captures shipping address accurately'
    );

    console.log('\n--- Test 3: Hook 2 - Simulated Payment Confirmation ---');
    const orderRes2 = await orderService.createOrder(customerUser._id, {
      items: [{ productId: product._id.toString(), variantSku: 'P51-VAR-01', quantity: 1 }],
      shippingAddressId: addressId,
    });
    const order2 = orderRes2.order;
    await Invoice.deleteMany({ order: order2._id });

    const simRes = await orderService.simulatePayment(customerUser._id, order2._id.toString(), {
      cardNumber: '4242424242424242',
      expiry: '12/28',
      cvv: '123',
      cardholderName: 'P51 Customer',
    });
    assert(simRes.approved === true, 'Simulated payment approved');
    assert(simRes.order.status === 'confirmed', 'Order transitioned to confirmed via simulated payment');

    const invoice2 = await Invoice.findOne({ order: order2._id });
    assert(!!invoice2, 'Invoice document created for simulated online payment');
    assert(
      invoice2?.snapshot.paymentMethod === 'simulated_online',
      'Invoice snapshot paymentMethod is simulated_online',
      `Got ${invoice2?.snapshot.paymentMethod}`
    );
    assert(
      invoice2?.snapshot.pointsUsed === null,
      'Invoice snapshot pointsUsed is null for simulated payment'
    );

    console.log('\n--- Test 4: Hook 3 - Bank Transfer Slip Review Approval ---');
    const orderRes3 = await orderService.createOrder(customerUser._id, {
      items: [{ productId: product._id.toString(), variantSku: 'P51-VAR-01', quantity: 1 }],
      shippingAddressId: addressId,
    });
    const order3 = orderRes3.order;
    await Invoice.deleteMany({ order: order3._id });

    // Submit slip
    await orderService.submitPaymentSlip(customerUser._id, order3._id.toString(), 'p51_slip.jpg');
    const slipOrder = await Order.findById(order3._id);
    assert(slipOrder?.status === 'payment_review', 'Order is in payment_review status');

    // Staff approves slip -> transitions to confirmed
    const approvedOrder = await orderService.transitionStatus(
      staffUser,
      order3._id.toString(),
      'confirmed',
      { reviewNote: 'Bank slip verified' }
    );
    assert(approvedOrder.status === 'confirmed', 'Staff transitioned order to confirmed');

    const invoice3 = await Invoice.findOne({ order: order3._id });
    assert(!!invoice3, 'Invoice document created on slip approval');
    assert(
      invoice3?.snapshot.paymentMethod === 'bank_transfer',
      'Invoice snapshot paymentMethod is bank_transfer',
      `Got ${invoice3?.snapshot.paymentMethod}`
    );
    assert(
      invoice3?.snapshot.paymentStatus === 'approved',
      'Invoice snapshot paymentStatus is approved'
    );

    console.log('\n--- Test 5: Idempotency & Unique Document Guard ---');
    // Call generateInvoice again on order1
    const pmt1 = await Payment.findOne({ order: order1._id });
    const reinvoice = await invoiceService.generateInvoice(order1, pmt1);
    assert(
      reinvoice._id.toString() === invoice1?._id.toString(),
      'generateInvoice is idempotent and returns existing invoice'
    );

    const count = await Invoice.countDocuments({ order: order1._id });
    assert(count === 1, 'Exactly one Invoice document persists in MongoDB for the order', `Count is ${count}`);

    // Direct duplicate insert attempt must fail with MongoServerError E11000
    let duplicateRejected = false;
    try {
      await Invoice.create({
        invoiceNumber: 'INV-DIFFERENT',
        order: order1._id, // duplicate order ref!
        user: customerUser._id,
        snapshot: invoice1!.snapshot,
        issuedAt: new Date(),
      });
    } catch (err: any) {
      if (err.code === 11000 || err.name === 'MongoServerError') {
        duplicateRejected = true;
      }
    }
    assert(duplicateRejected, 'MongoDB unique index enforces exactly one Invoice per Order');

    console.log('\n--- Test 6: HTTP GET /api/invoices/:orderId Access Control ---');
    // Owner access -> 200
    const resOwner = await jsonRequest('GET', `/api/invoices/${order1._id}`, undefined, customerCookie);
    assert(resOwner.status === 200, 'Order owner can access invoice (200 OK)', `Got ${resOwner.status}`);
    assert(
      resOwner.body?.data?.invoiceNumber === invoice1?.invoiceNumber,
      'Response returns invoice data matching order',
      `Got ${resOwner.body?.data?.invoiceNumber}`
    );

    // Staff access -> 200
    const resStaff = await jsonRequest('GET', `/api/invoices/${order1._id}`, undefined, staffCookie);
    assert(resStaff.status === 200, 'Staff can access customer invoice (200 OK)', `Got ${resStaff.status}`);

    // Different customer access -> 403
    const resOther = await jsonRequest('GET', `/api/invoices/${order1._id}`, undefined, otherCustomerCookie);
    assert(
      resOther.status === 403,
      'Different customer is denied access (403 Forbidden)',
      `Got ${resOther.status}`
    );

    // Unauthenticated access -> 401
    const resUnauth = await jsonRequest('GET', `/api/invoices/${order1._id}`);
    assert(resUnauth.status === 401, 'Unauthenticated request is rejected (401 Unauthorized)', `Got ${resUnauth.status}`);

    // Non-existent order -> 404
    const fakeOrderId = new Types.ObjectId();
    const resNotFound = await jsonRequest('GET', `/api/invoices/${fakeOrderId}`, undefined, customerCookie);
    assert(resNotFound.status === 404, 'Non-existent order returns 404 Not Found', `Got ${resNotFound.status}`);

    // Unconfirmed order (no invoice yet) -> 404
    const unconfirmedOrderRes = await orderService.createOrder(customerUser._id, {
      items: [{ productId: product._id.toString(), variantSku: 'P51-VAR-01', quantity: 1 }],
      shippingAddressId: addressId,
    });
    const unconfirmedOrder = unconfirmedOrderRes.order;
    const resUnconfirmed = await jsonRequest(
      'GET',
      `/api/invoices/${unconfirmedOrder._id}`,
      undefined,
      customerCookie
    );
    assert(
      resUnconfirmed.status === 404,
      'Unconfirmed order returns 404 for invoice',
      `Got ${resUnconfirmed.status}`
    );

    // Invalid orderId format -> 400
    const resInvalidId = await jsonRequest('GET', '/api/invoices/invalid-id-123', undefined, customerCookie);
    assert(resInvalidId.status === 400, 'Invalid orderId format returns 400 Bad Request', `Got ${resInvalidId.status}`);

  } finally {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await mongoose.disconnect();
  }

  console.log('\n========================================');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
