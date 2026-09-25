import http from 'http';
import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import app from './src/app';
import { User } from './src/models/User';
import { Order } from './src/models/Order';
import { Product } from './src/models/Product';
import { Wallet } from './src/models/Wallet';
import { Invoice } from './src/models/Invoice';
import { orderService } from './src/services/order.service';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_1234567890_super_secret';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shop';

function makeAuthCookie(userId: string): string {
  const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
  return `slt=${token}`;
}

let server: http.Server;
let serverPort: number;

function rawRequest(
  method: string,
  path: string,
  cookie?: string
): Promise<{ status: number; headers: http.IncomingHttpHeaders; buffer: Buffer }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
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
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.from(c)));
        res.on('end', () => {
          resolve({
            status: res.statusCode || 500,
            headers: res.headers,
            buffer: Buffer.concat(chunks),
          });
        });
      }
    );

    req.on('error', reject);
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
  console.log('  P52 Invoice PDF Streaming Test Suite  ');
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
    const customerUserA = await User.findOneAndUpdate(
      { email: 'p52_customer_a@test.com' },
      {
        name: 'P52 Alice Kundu',
        email: 'p52_customer_a@test.com',
        passwordHash: 'dummy',
        role: 'customer',
        active: true,
        addresses: [
          {
            label: 'Home',
            line1: '42 Lotus Road',
            city: 'Colombo 01',
            province: 'Western',
            postalCode: '00100',
            country: 'Sri Lanka',
            isDefault: true,
          },
        ],
      },
      { upsert: true, new: true }
    );

    const customerUserB = await User.findOneAndUpdate(
      { email: 'p52_customer_b@test.com' },
      {
        name: 'P52 Bob Perera',
        email: 'p52_customer_b@test.com',
        passwordHash: 'dummy',
        role: 'customer',
        active: true,
        addresses: [
          {
            label: 'Home',
            line1: '99 High Level Road',
            city: 'Nugegoda',
            province: 'Western',
            postalCode: '10250',
            country: 'Sri Lanka',
            isDefault: true,
          },
        ],
      },
      { upsert: true, new: true }
    );

    const staffUser = await User.findOneAndUpdate(
      { email: 'p52_staff@test.com' },
      {
        name: 'P52 Staff Member',
        email: 'p52_staff@test.com',
        passwordHash: 'dummy',
        role: 'staff',
        active: true,
      },
      { upsert: true, new: true }
    );

    const cookieA = makeAuthCookie(customerUserA._id.toString());
    const cookieB = makeAuthCookie(customerUserB._id.toString());
    const cookieStaff = makeAuthCookie(staffUser._id.toString());

    // Setup test product
    const product = await Product.findOneAndUpdate(
      { slug: 'p52-linen-shirt' },
      {
        name: 'P52 Linen Safari Shirt',
        slug: 'p52-linen-shirt',
        description: 'Invoice test safari shirt',
        basePrice: 4200,
        status: 'active',
        images: ['/uploads/products/safari.jpg'],
        variants: [
          {
            sku: 'P52-SAF-01',
            size: 'L',
            color: 'Khaki',
            stock: 200,
            price: 4200,
          },
        ],
      },
      { upsert: true, new: true }
    );

    const addressIdA = customerUserA.addresses[0]._id!.toString();

    // ── Scenario 1: Confirmed Order via Simulated Card ───────────────────────
    console.log('\n--- Test 1: Generate & Stream PDF for Card Payment Order ---');
    const orderRes1 = await orderService.createOrder(customerUserA._id, {
      items: [{ productId: product._id.toString(), variantSku: 'P52-SAF-01', quantity: 1 }],
      shippingAddressId: addressIdA,
    });
    const order1 = orderRes1.order;

    // Simulate approved payment -> transitions to 'confirmed' and hooks invoice generation
    await orderService.simulatePayment(customerUserA._id, order1._id.toString(), {
      cardNumber: '4242424242424242',
      expiry: '12/28',
      cvv: '123',
      cardholderName: 'Alice Kundu',
    });

    // Request PDF as owner
    const resPdf1 = await rawRequest('GET', `/api/invoices/${order1._id}/pdf`, cookieA);
    assert(resPdf1.status === 200, 'GET /api/invoices/:orderId/pdf returns HTTP 200 for owner');
    assert(
      resPdf1.headers['content-type'] === 'application/pdf',
      'Content-Type is application/pdf',
      `Got: ${resPdf1.headers['content-type']}`
    );
    assert(
      (resPdf1.headers['content-disposition'] || '').includes('attachment; filename='),
      'Content-Disposition header specifies attachment filename',
      `Got: ${resPdf1.headers['content-disposition']}`
    );
    const pdfMagic = resPdf1.buffer.slice(0, 5).toString('utf-8');
    assert(pdfMagic === '%PDF-', 'Response payload starts with %PDF- magic bytes', `Got: ${pdfMagic}`);
    assert(resPdf1.buffer.length > 2000, `PDF stream has realistic byte size (${resPdf1.buffer.length} bytes)`);

    // ── Scenario 2: Reward Points Paid Order PDF ─────────────────────────────
    console.log('\n--- Test 2: Reward Points Paid Order PDF Content ---');
    // Ensure customer A has plenty of reward points
    await Wallet.findOneAndUpdate(
      { user: customerUserA._id },
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

    const orderRes2 = await orderService.createOrder(customerUserA._id, {
      items: [{ productId: product._id.toString(), variantSku: 'P52-SAF-01', quantity: 2 }],
      shippingAddressId: addressIdA,
    });
    const order2 = orderRes2.order;

    // Pay with wallet reward points -> transitions to confirmed and hooks invoice
    const walletRes = await orderService.payWithWallet(customerUserA._id, order2._id.toString());
    assert(walletRes.order.status === 'confirmed', 'Reward points order status is confirmed');

    const resPdf2 = await rawRequest('GET', `/api/invoices/${order2._id}/pdf`, cookieA);
    assert(resPdf2.status === 200, 'GET /api/invoices/:orderId/pdf returns 200 for reward points order');
    assert(
      resPdf2.buffer.slice(0, 5).toString('utf-8') === '%PDF-',
      'Reward points invoice PDF starts with %PDF-'
    );

    const inv2 = await Invoice.findOne({ order: order2._id });
    assert(inv2?.snapshot.paymentMethod === 'reward_points', 'DB Invoice snapshot paymentMethod is reward_points');
    assert((inv2?.snapshot.pointsUsed || 0) > 0, 'DB Invoice snapshot pointsUsed is greater than zero');

    // PDFKit encodes characters in hex within <...> TJ blocks with kerning numbers in between
    let decodedAll = '';
    const rawPdf = resPdf2.buffer.toString('utf-8');
    const hexRegex = /<([0-9a-fA-F]+)>/g;
    let match;
    while ((match = hexRegex.exec(rawPdf)) !== null) {
      try {
        decodedAll += Buffer.from(match[1], 'hex').toString('utf-8');
      } catch {}
    }

    const hasRewardPointsText =
      decodedAll.includes('Reward Points') &&
      decodedAll.includes('pts');
    assert(hasRewardPointsText, 'PDF stream encodes reward point payment detail and points quantity');

    // ── Scenario 3: Access Control & Permissions ─────────────────────────────
    console.log('\n--- Test 3: PDF Endpoint Access Control & RBAC ---');
    // Staff access to customer A's invoice PDF -> 200 OK
    const resStaff = await rawRequest('GET', `/api/invoices/${order1._id}/pdf`, cookieStaff);
    assert(resStaff.status === 200, 'Staff member can download customer invoice PDF (200 OK)');
    assert(
      resStaff.buffer.slice(0, 5).toString('utf-8') === '%PDF-',
      'Staff response is a valid %PDF- document'
    );

    // Other customer B accessing customer A's invoice PDF -> 403 Forbidden
    const resForbidden = await rawRequest('GET', `/api/invoices/${order1._id}/pdf`, cookieB);
    assert(resForbidden.status === 403, 'Unauthorized customer is rejected (403 Forbidden)', `Got: ${resForbidden.status}`);

    // Unauthenticated request -> 401 Unauthorized
    const resUnauth = await rawRequest('GET', `/api/invoices/${order1._id}/pdf`);
    assert(resUnauth.status === 401, 'Unauthenticated request is rejected (401 Unauthorized)', `Got: ${resUnauth.status}`);

    // ── Scenario 4: Error Handling (Unconfirmed / Non-existent / Invalid) ────
    console.log('\n--- Test 4: Error States (Unconfirmed, Non-existent, Invalid) ---');
    // Unconfirmed order in pending_payment -> 404
    const unconfirmedOrderRes = await orderService.createOrder(customerUserA._id, {
      items: [{ productId: product._id.toString(), variantSku: 'P52-SAF-01', quantity: 1 }],
      shippingAddressId: addressIdA,
    });
    const unconfirmedOrder = unconfirmedOrderRes.order;
    const resUnconfirmed = await rawRequest('GET', `/api/invoices/${unconfirmedOrder._id}/pdf`, cookieA);
    assert(
      resUnconfirmed.status === 404,
      'Unconfirmed order returns 404 Not Found for PDF',
      `Got: ${resUnconfirmed.status}`
    );

    // Non-existent order ID -> 404
    const nonExistentId = new Types.ObjectId();
    const resNotFound = await rawRequest('GET', `/api/invoices/${nonExistentId}/pdf`, cookieA);
    assert(
      resNotFound.status === 404,
      'Non-existent order returns 404 Not Found for PDF',
      `Got: ${resNotFound.status}`
    );

    // Malformed order ID -> 400
    const resMalformed = await rawRequest('GET', `/api/invoices/invalid-order-id-xyz/pdf`, cookieA);
    assert(
      resMalformed.status === 400,
      'Malformed order ID returns 400 Bad Request',
      `Got: ${resMalformed.status}`
    );

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
