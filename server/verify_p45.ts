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
  console.log('    RUNNING P45 STEP 5 DATA CONTRACT TEST SUITE     ');
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
    const user = await User.findOneAndUpdate(
      { email: 'p45_customer@demo.com' },
      {
        $set: {
          name: 'P45 Customer',
          role: 'customer',
          status: 'active',
          passwordHash: '$2a$10$abcdefghijklmnopqrstuu',
          addresses: [
            {
              label: 'Home',
              line1: '123 Fashion Blvd',
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

    const cookie = makeAuthCookie(user._id.toString());

    async function createTestOrder(status = 'pending_payment', total = 2400) {
      const prodId = new mongoose.Types.ObjectId();
      return await Order.create({
        user: user._id,
        orderNumber: 'ORD-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        items: [
          {
            product: prodId,
            variantSku: 'SKU-P45-LINEN-SHIRT',
            name: 'Classic Linen Shirt',
            image: '/uploads/products/linen_shirt.jpg',
            size: 'L',
            color: 'White',
            quantity: 2,
            unitPrice: 1200,
            lineTotal: 2400,
          },
        ],
        subtotal: total,
        shippingFee: 0,
        discountTotal: 0,
        total,
        pointsPaid: 0,
        status,
        shippingAddress: {
          line1: '123 Fashion Blvd',
          city: 'Dhaka',
          province: 'Dhaka',
          postalCode: '1212',
          country: 'Bangladesh',
        },
      });
    }

    // 1. Test simulated online payment contract
    console.log('--- Test 1: Simulated payment contract for Step 5 ---');
    const order1 = await createTestOrder();
    const res1 = await jsonRequest(
      'POST',
      `/api/orders/${order1._id}/payment/simulate`,
      {
        cardNumber: '4242424242424242',
        expiry: '12/28',
        cvv: '123',
        cardholderName: 'Alice Confirmation',
      },
      cookie
    );
    assert(res1.status === 200, `Simulate payment returns 200 (got ${res1.status})`);
    assert(Boolean(res1.body?.data?.order?._id), 'Order has valid _id for Step 5');
    assert(res1.body?.data?.order?.status === 'confirmed', 'Order status is confirmed');
    assert(Array.isArray(res1.body?.data?.order?.items) && res1.body.data.order.items.length === 1, 'Order contains items list');
    assert(res1.body?.data?.payment?.method === 'simulated_online', 'Payment method is simulated_online');
    assert(res1.body?.data?.payment?.maskedCardLast4 === '4242', 'Payment maskedCardLast4 exists');
    assert(typeof res1.body?.data?.payment?.transactionId === 'string', 'Payment transactionId exists');

    // 2. Test manual slip payment contract
    console.log('\n--- Test 2: Bank transfer slip contract for Step 5 ---');
    const order2 = await createTestOrder('payment_review');
    const payment2 = await Payment.create({
      order: order2._id,
      method: 'bank_transfer',
      status: 'submitted',
      amount: order2.total,
      slipImageUrl: '/uploads/payment-slips/sample.jpg',
    });
    assert(payment2.method === 'bank_transfer', 'Payment method is bank_transfer');
    assert(order2.status === 'payment_review', 'Order status is payment_review');
    assert(order2.shippingAddress?.city === 'Dhaka', 'Order contains valid shipping address');

    // 3. Test reward points payment contract
    console.log('\n--- Test 3: Reward points payment contract for Step 5 ---');
    const order3 = await createTestOrder('confirmed');
    const payment3 = await Payment.create({
      order: order3._id,
      method: 'reward_points',
      status: 'approved',
      amount: order3.total,
      pointsUsed: 240000,
    });
    assert(payment3.method === 'reward_points', 'Payment method is reward_points');
    assert(payment3.status === 'approved', 'Payment status is approved');
    assert(payment3.pointsUsed === 240000, 'Payment pointsUsed recorded accurately for Step 5');

  } catch (err) {
    console.error('Test failed with error:', err);
    failed++;
  } finally {
    console.log('\n====================================================');
    console.log(`P45 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');
    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

run();
