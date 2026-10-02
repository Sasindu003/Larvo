import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { User } from './src/models/User';
import { Product } from './src/models/Product';
import { Order } from './src/models/Order';
import { Payment } from './src/models/Payment';
import { Wallet } from './src/models/Wallet';
import { walletService } from './src/services/wallet.service';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_1234567890_super_secret';

function makeAuthCookie(userId: string): string {
  const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
  return `slt=${token}`;
}

function uploadRequest(
  orderId: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string,
  cookie?: string
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substring(2);
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="slip"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const payload = Buffer.concat([head, fileBuffer, tail]);

    const headers: Record<string, string> = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': payload.length.toString(),
    };
    if (cookie) headers['Cookie'] = cookie;

    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: `/api/orders/${orderId}/payment/slip`,
        method: 'POST',
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
    req.write(payload);
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log('      RUNNING P43 MANUAL PAYMENT SLIP TEST SUITE     ');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/shop';
  await mongoose.connect(mongoUri);
  console.log('✔ Connected directly to MongoDB for fixtures and verification.\n');

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
    // 1. Setup test users
    const userA = await User.findOneAndUpdate(
      { email: 'p43_test_user_a@demo.com' },
      {
        $set: {
          name: 'P43 User A',
          role: 'customer',
          status: 'active',
          passwordHash: '$2a$10$abcdefghijklmnopqrstuu',
          addresses: [
            {
              label: 'Home',
              line1: '123 Test Street',
              city: 'Dhaka',
              province: 'Dhaka',
              postalCode: '1212',
              country: 'Bangladesh',
              isDefault: true,
            },
          ],
        },
      },
      { upsert: true, new: true }
    );

    const userB = await User.findOneAndUpdate(
      { email: 'p43_test_user_b@demo.com' },
      {
        $set: {
          name: 'P43 User B',
          role: 'customer',
          status: 'active',
          passwordHash: '$2a$10$abcdefghijklmnopqrstuu',
          addresses: [
            {
              label: 'Work',
              line1: '456 Other Street',
              city: 'Chittagong',
              province: 'Chittagong',
              postalCode: '4000',
              country: 'Bangladesh',
              isDefault: true,
            },
          ],
        },
      },
      { upsert: true, new: true }
    );

    const cookieA = makeAuthCookie(userA._id.toString());
    const cookieB = makeAuthCookie(userB._id.toString());

    // Helper: Create a fresh order for userA
    async function createTestOrder(status = 'pending_payment') {
      const prodId = new mongoose.Types.ObjectId();
      const order = await Order.create({
        user: userA._id,
        orderNumber: `ORD-P43-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        items: [
          {
            product: prodId,
            variantSku: `SKU-P43-${Date.now()}`,
            name: 'P43 Test Garment',
            image: '/uploads/products/test.jpg',
            size: 'M',
            color: 'Navy',
            quantity: 2,
            unitPrice: 500,
            lineTotal: 1000,
          },
        ],
        subtotal: 1000,
        shippingFee: 60,
        discountTotal: 0,
        total: 1060,
        pointsPaid: 0,
        status,
        shippingAddress: {
          label: userA.addresses[0].label,
          line1: userA.addresses[0].line1,
          city: userA.addresses[0].city,
          province: userA.addresses[0].province,
          postalCode: userA.addresses[0].postalCode,
          country: userA.addresses[0].country,
        },
      });
      return order;
    }

    // ----------------------------------------------------
    // Scenario 1: Upload file exceeding 5MB limit -> 413
    // ----------------------------------------------------
    console.log('--- Scenario 1: File size > 5MB limit ---');
    const order1 = await createTestOrder();
    const largeBuffer = Buffer.alloc(5.5 * 1024 * 1024); // 5.5 MB
    const res1 = await uploadRequest(order1._id.toString(), 'large_slip.jpg', largeBuffer, 'image/jpeg', cookieA);
    assert(res1.status === 413, `Upload > 5MB returns 413 (got ${res1.status})`);
    assert(res1.body?.success === false, 'Response has success: false');

    // ----------------------------------------------------
    // Scenario 2: Upload invalid file type (e.g. text/plain or executable) -> 400
    // ----------------------------------------------------
    console.log('\n--- Scenario 2: Invalid file MIME type ---');
    const invalidBuffer = Buffer.from('console.log("hello");');
    const res2 = await uploadRequest(order1._id.toString(), 'slip.txt', invalidBuffer, 'text/plain', cookieA);
    assert(res2.status === 400, `Upload text/plain returns 400 (got ${res2.status})`);
    assert(res2.body?.success === false, 'Response has success: false');

    // ----------------------------------------------------
    // Scenario 3: Upload for another user\'s order -> 403
    // ----------------------------------------------------
    console.log('\n--- Scenario 3: Ownership check (User B attempts to upload slip for User A\'s order) ---');
    const validSlipBuffer = Buffer.from('dummy-jpeg-content-12345');
    const res3 = await uploadRequest(order1._id.toString(), 'slip.jpg', validSlipBuffer, 'image/jpeg', cookieB);
    assert(res3.status === 403, `User B uploading for User A order returns 403 (got ${res3.status})`);
    assert(res3.body?.message?.includes('access') || res3.body?.success === false, 'Response mentions access forbidden');

    // ----------------------------------------------------
    // Scenario 4: Upload for cancelled order -> 409
    // ----------------------------------------------------
    console.log('\n--- Scenario 4: Status gate (Cancelled order) ---');
    const orderCancelled = await createTestOrder('cancelled');
    const res4 = await uploadRequest(orderCancelled._id.toString(), 'slip.jpg', validSlipBuffer, 'image/jpeg', cookieA);
    assert(res4.status === 409, `Upload for cancelled order returns 409 (got ${res4.status})`);

    // ----------------------------------------------------
    // Scenario 5: Valid slip upload (JPEG) -> 200, Payment submitted, Order payment_review
    // ----------------------------------------------------
    console.log('\n--- Scenario 5: Valid slip upload ---');
    const res5 = await uploadRequest(order1._id.toString(), 'bank_deposit.jpg', validSlipBuffer, 'image/jpeg', cookieA);
    assert(res5.status === 200, `Valid upload returns 200 (got ${res5.status})`);
    assert(res5.body?.success === true, 'Response has success: true');
    assert(res5.body?.data?.payment?.status === 'submitted', 'Payment status is "submitted"');
    assert(res5.body?.data?.order?.status === 'payment_review', 'Order status is "payment_review"');
    assert(res5.body?.data?.payment?.method === 'bank_transfer', 'Payment method is "bank_transfer"');
    assert(typeof res5.body?.data?.payment?.slipImageUrl === 'string', 'Payment has slipImageUrl');
    assert(res5.body?.data?.payment?.slipImageUrl.startsWith('/uploads/payment-slips/'), 'slipImageUrl starts with /uploads/payment-slips/');

    // Verify file exists on local filesystem
    const filename = path.basename(res5.body.data.payment.slipImageUrl);
    const diskPath = path.resolve(__dirname, 'uploads/payment-slips', filename);
    assert(fs.existsSync(diskPath), `Uploaded slip file exists on disk at ${diskPath}`);

    // Verify database state
    const savedOrder = await Order.findById(order1._id);
    assert(savedOrder?.status === 'payment_review', 'Order in DB is payment_review');
    const savedPayment = await Payment.findOne({ order: order1._id });
    assert(savedPayment?.status === 'submitted', 'Payment in DB is submitted');
    assert(savedPayment?.method === 'bank_transfer', 'Payment in DB is bank_transfer');

    // ----------------------------------------------------
    // Scenario 6: Upload second slip while already submitted -> 409
    // ----------------------------------------------------
    console.log('\n--- Scenario 6: Duplicate upload while submitted ---');
    const res6 = await uploadRequest(order1._id.toString(), 'second_slip.jpg', validSlipBuffer, 'image/jpeg', cookieA);
    assert(res6.status === 409, `Second upload while submitted returns 409 (got ${res6.status})`);

    // ----------------------------------------------------
    // Scenario 7: Resubmission after rejection -> 200, same _id overwritten
    // ----------------------------------------------------
    console.log('\n--- Scenario 7: Resubmission after staff rejects ---');
    // Simulate staff rejecting the payment and resetting order to pending_payment
    const originalPaymentId = savedPayment!._id.toString();
    await Payment.findByIdAndUpdate(originalPaymentId, { status: 'rejected' });
    await Order.findByIdAndUpdate(order1._id, { status: 'pending_payment' });

    const newSlipBuffer = Buffer.from('new-corrected-slip-content-67890');
    const res7 = await uploadRequest(order1._id.toString(), 'corrected_slip.png', newSlipBuffer, 'image/png', cookieA);
    assert(res7.status === 200, `Resubmission after rejection returns 200 (got ${res7.status})`);
    assert(res7.body?.data?.payment?._id === originalPaymentId, `Payment _id preserved after overwrite (got ${res7.body?.data?.payment?._id})`);
    assert(res7.body?.data?.payment?.status === 'submitted', 'Payment status is back to "submitted"');
    assert(res7.body?.data?.payment?.slipImageUrl !== savedPayment?.slipImageUrl, 'Payment has new slipImageUrl');
    assert(res7.body?.data?.order?.status === 'payment_review', 'Order status updated back to "payment_review"');

    // ----------------------------------------------------
    // Scenario 8: Conflict with reward_points approved payment -> 409
    // ----------------------------------------------------
    console.log('\n--- Scenario 8: Slip upload on approved reward_points payment ---');
    const orderPoints = await createTestOrder('pending_payment');
    // Ensure user has points
    await Wallet.findOneAndUpdate(
      { user: userA._id },
      { $set: { balancePoints: 200000, active: true } },
      { upsert: true }
    );
    await walletService.credit({
      userId: userA._id,
      points: 200000,
      type: 'admin_credit',
      idempotencyKey: `p43_test_credit_${Date.now()}`,
      note: 'Seed for P43 test',
    });
    // Pay with points
    const { orderService } = await import('./src/services/order.service');
    await orderService.payWithWallet(userA._id, orderPoints._id.toString());

    // Attempt slip upload on the paid order
    const res8 = await uploadRequest(orderPoints._id.toString(), 'slip_after_points.jpg', validSlipBuffer, 'image/jpeg', cookieA);
    assert(res8.status === 409, `Upload slip on points-paid order returns 409 (got ${res8.status})`);
    assert(res8.body?.message?.includes('paid') || res8.body?.message?.includes('status'), 'Error mentions order already paid or invalid status');

    console.log('\n====================================================');
    console.log(`P43 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');
  } catch (err) {
    console.error('Test run failed with error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

run();
