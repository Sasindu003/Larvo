import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { User } from './src/models/User';
import { Order } from './src/models/Order';
import { Payment } from './src/models/Payment';

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
  console.log('    RUNNING P44 SIMULATED GATEWAY TEST SUITE        ');
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
      { email: 'p44_test_user_a@demo.com' },
      {
        $set: {
          name: 'P44 User A',
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
      { email: 'p44_test_user_b@demo.com' },
      {
        $set: {
          name: 'P44 User B',
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

    async function createTestOrder(ownerId: any, status = 'pending_payment', total = 1200) {
      const prodId = new mongoose.Types.ObjectId();
      return await Order.create({
        user: ownerId,
        orderNumber: 'ORD-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        items: [
          {
            product: prodId,
            variantSku: 'SKU-P44-TEST',
            name: 'P44 Test Product',
            image: '/uploads/products/test.jpg',
            size: 'M',
            color: 'Blue',
            quantity: 1,
            unitPrice: total,
            lineTotal: total,
          },
        ],
        subtotal: total,
        shippingFee: 0,
        discountTotal: 0,
        total,
        pointsPaid: 0,
        status,
        shippingAddress: {
          line1: '123 Test Street',
          city: 'Dhaka',
          province: 'Dhaka',
          postalCode: '1212',
          country: 'Bangladesh',
        },
      });
    }

    // SCENARIO 1: Approved test card (4242424242424242)
    console.log('--- Test 1: Approved card 4242424242424242 ---');
    const order1 = await createTestOrder(userA._id);
    const res1 = await jsonRequest(
      'POST',
      `/api/orders/${order1._id}/payment/simulate`,
      {
        cardNumber: '4242424242424242',
        expiry: '12/28',
        cvv: '123',
        cardholderName: 'Alice Valid',
      },
      cookieA
    );
    assert(res1.status === 200, `Returns HTTP 200 (got ${res1.status})`);
    assert(res1.body?.success === true, 'Response success is true');
    assert(res1.body?.data?.approved === true, 'Payment data.approved is true');
    assert(res1.body?.data?.order?.status === 'confirmed', 'Order status updated to confirmed in response');
    assert(res1.body?.data?.payment?.maskedCardLast4 === '4242', 'Payment maskedCardLast4 is 4242');
    assert(res1.body?.data?.payment?.transactionId !== 'declined', 'Payment transactionId is valid UUID');

    // DB checks for Scenario 1
    const dbOrder1 = await Order.findById(order1._id);
    const dbPayment1 = await Payment.findOne({ order: order1._id });
    assert(dbOrder1?.status === 'confirmed', 'Order in DB updated to confirmed');
    assert(dbPayment1?.status === 'approved', 'Payment in DB status is approved');
    assert(dbPayment1?.method === 'simulated_online', 'Payment in DB method is simulated_online');

    // SCENARIO 2: Declined test card (4000000000000002)
    console.log('\n--- Test 2: Declined card 4000000000000002 ---');
    const order2 = await createTestOrder(userA._id);
    const res2 = await jsonRequest(
      'POST',
      `/api/orders/${order2._id}/payment/simulate`,
      {
        cardNumber: '4000000000000002',
        expiry: '12/28',
        cvv: '999',
        cardholderName: 'Bob Decline',
      },
      cookieA
    );
    assert(res2.status === 200, `Returns HTTP 200 on decline (got ${res2.status})`);
    assert(res2.body?.success === true, 'Response success is true');
    assert(res2.body?.data?.approved === false, 'data.approved is false');
    assert(res2.body?.data?.order?.status === 'pending_payment', 'Order status remains pending_payment');
    assert(res2.body?.data?.payment?.status === 'rejected', 'Payment status is rejected');

    const dbOrder2 = await Order.findById(order2._id);
    const dbPayment2 = await Payment.findOne({ order: order2._id });
    assert(dbOrder2?.status === 'pending_payment', 'DB order remains pending_payment');
    assert(dbPayment2?.status === 'rejected', 'DB payment is rejected');
    assert(dbPayment2?.gatewayResponseCode === 'card_declined', 'gatewayResponseCode is card_declined');

    // SCENARIO 3: Spaces and formatting in card number
    console.log('\n--- Test 3: Card number with spaces and formatting ---');
    const order3 = await createTestOrder(userA._id);
    const res3 = await jsonRequest(
      'POST',
      `/api/orders/${order3._id}/payment/simulate`,
      {
        cardNumber: '4242 4242 4242 4242',
        expiry: '11/29',
        cvv: '456',
        cardholderName: 'Carol Spaces',
      },
      cookieA
    );
    assert(res3.status === 200, 'Handled spaces in card number properly (HTTP 200)');
    assert(res3.body?.data?.approved === true, 'Approved with spaced card number');
    assert(res3.body?.data?.payment?.maskedCardLast4 === '4242', 'Masked card last 4 is 4242');

    // SCENARIO 4: Luhn check failure
    console.log('\n--- Test 4: Luhn check failure (no payment doc created) ---');
    const order4 = await createTestOrder(userA._id);
    const res4 = await jsonRequest(
      'POST',
      `/api/orders/${order4._id}/payment/simulate`,
      {
        cardNumber: '4242424242424241', // Luhn fail
        expiry: '12/28',
        cvv: '123',
        cardholderName: 'Bad Luhn',
      },
      cookieA
    );
    assert(res4.status === 422, `Luhn failure returns 422 validation error (got ${res4.status})`);
    const dbPayment4 = await Payment.findOne({ order: order4._id });
    assert(dbPayment4 === null, 'No payment document was created in DB');

    // SCENARIO 5: Missing / invalid fields
    console.log('\n--- Test 5: Missing CVV and invalid expiry ---');
    const order5 = await createTestOrder(userA._id);
    const res5 = await jsonRequest(
      'POST',
      `/api/orders/${order5._id}/payment/simulate`,
      {
        cardNumber: '4242424242424242',
        expiry: '99/99',
        cardholderName: 'Missing Fields',
      },
      cookieA
    );
    assert(res5.status === 422, `Validation error 422 on invalid expiry and missing CVV (got ${res5.status})`);

    // SCENARIO 6: Idempotency: Re-submitting on already-approved simulated order
    console.log('\n--- Test 6: Idempotent re-submit on already-approved simulated order ---');
    const initialTxnId = dbPayment1?.transactionId;
    const res6 = await jsonRequest(
      'POST',
      `/api/orders/${order1._id}/payment/simulate`,
      {
        cardNumber: '4242424242424242',
        expiry: '12/28',
        cvv: '123',
        cardholderName: 'Alice Valid',
      },
      cookieA
    );
    assert(res6.status === 200, `Returns 200 on idempotent retry (got ${res6.status})`);
    assert(res6.body?.data?.approved === true, 'Approved is true');
    assert(res6.body?.data?.payment?.transactionId === initialTxnId, 'Transaction ID preserved identically');
    const paymentCount = await Payment.countDocuments({ order: order1._id });
    assert(paymentCount === 1, 'Still exactly 1 payment document for the order');

    // SCENARIO 7: Cross-method conflict: Order confirmed via reward_points
    console.log('\n--- Test 7: Cross-method conflict (order paid via reward_points) ---');
    const order7 = await createTestOrder(userA._id, 'confirmed');
    await Payment.create({
      order: order7._id,
      method: 'reward_points',
      status: 'approved',
      amount: order7.total,
      pointsUsed: 120000,
    });
    const res7 = await jsonRequest(
      'POST',
      `/api/orders/${order7._id}/payment/simulate`,
      {
        cardNumber: '4242424242424242',
        expiry: '12/28',
        cvv: '123',
        cardholderName: 'Cross Method',
      },
      cookieA
    );
    assert(res7.status === 409, `Returns 409 conflict for reward_points-paid order (got ${res7.status})`);

    // SCENARIO 8: Conflict guard: Order in payment_review via manual slip
    console.log('\n--- Test 8: Conflict guard (order already under slip review) ---');
    const order8 = await createTestOrder(userA._id, 'payment_review');
    await Payment.create({
      order: order8._id,
      method: 'bank_transfer',
      status: 'submitted',
      slipImageUrl: '/uploads/payment-slips/test.png',
      amount: order8.total,
    });
    const res8 = await jsonRequest(
      'POST',
      `/api/orders/${order8._id}/payment/simulate`,
      {
        cardNumber: '4242424242424242',
        expiry: '12/28',
        cvv: '123',
        cardholderName: 'Slip Under Review',
      },
      cookieA
    );
    assert(res8.status === 409, `Returns 409 conflict when slip already under review (got ${res8.status})`);

    // SCENARIO 9: Unauthorized user access (User B tries paying User A's order)
    console.log('\n--- Test 9: Unauthorized access (User B paying User A order) ---');
    const order9 = await createTestOrder(userA._id);
    const res9 = await jsonRequest(
      'POST',
      `/api/orders/${order9._id}/payment/simulate`,
      {
        cardNumber: '4242424242424242',
        expiry: '12/28',
        cvv: '123',
        cardholderName: 'Intruder',
      },
      cookieB
    );
    assert(res9.status === 403, `Returns 403 Forbidden for unauthorized user (got ${res9.status})`);

    // SCENARIO 10: Declined card followed by retry with success card (upsert overwrites rejected doc)
    console.log('\n--- Test 10: Retry after decline (upsert overwrite rejected doc) ---');
    const order10 = await createTestOrder(userA._id);
    // 1st attempt: decline
    const res10a = await jsonRequest(
      'POST',
      `/api/orders/${order10._id}/payment/simulate`,
      {
        cardNumber: '4000000000000002',
        expiry: '12/28',
        cvv: '000',
        cardholderName: 'Retry Tester',
      },
      cookieA
    );
    assert(res10a.status === 200 && res10a.body?.data?.approved === false, 'First attempt declined');
    const paymentBeforeRetry = await Payment.findOne({ order: order10._id });
    assert(paymentBeforeRetry?.status === 'rejected', 'Payment initially rejected in DB');

    // 2nd attempt: retry with approved card
    const res10b = await jsonRequest(
      'POST',
      `/api/orders/${order10._id}/payment/simulate`,
      {
        cardNumber: '4242424242424242',
        expiry: '12/28',
        cvv: '123',
        cardholderName: 'Retry Tester',
      },
      cookieA
    );
    assert(res10b.status === 200 && res10b.body?.data?.approved === true, 'Second attempt approved (got 200)');
    const paymentAfterRetry = await Payment.findOne({ order: order10._id });
    assert(paymentAfterRetry?.status === 'approved', 'DB payment status updated to approved');
    assert(
      paymentBeforeRetry?._id.toString() === paymentAfterRetry?._id.toString(),
      'Payment document _id preserved across upsert overwrite'
    );
    const dbOrder10 = await Order.findById(order10._id);
    assert(dbOrder10?.status === 'confirmed', 'DB order status updated to confirmed');

  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    console.log('\n====================================================');
    console.log(`P44 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');
    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

run();
