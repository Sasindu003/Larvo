import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { User } from './src/models/User';
import { Product } from './src/models/Product';
import { Order } from './src/models/Order';
import { Payment } from './src/models/Payment';
import { Wallet } from './src/models/Wallet';
import { PointsTransaction } from './src/models/PointsTransaction';
import { walletService } from './src/services/wallet.service';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_1234567890_super_secret';

function request(
  method: string,
  path: string,
  body?: any,
  cookie?: string
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cookie) headers['Cookie'] = cookie;
    if (data) headers['Content-Length'] = Buffer.byteLength(data).toString();

    const req = http.request(
      { hostname: 'localhost', port: 5000, path, method, headers },
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
          resolve({ status: res.statusCode || 500, body: parsed, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function makeAuthCookie(userId: string): string {
  const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
  return `slt=${token}`;
}

async function run() {
  console.log('====================================================');
  console.log('    RUNNING P42.1 WALLET POINTS PAYMENT TEST SUITE   ');
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
    // 0. Prepare test users
    const userA = await User.findOneAndUpdate(
      { email: 'wallet_customer_a@demo.com' },
      {
        $set: {
          name: 'Wallet Customer A',
          email: 'wallet_customer_a@demo.com',
          role: 'customer',
          addresses: [
            {
              label: 'Home',
              line1: '123 Test Street',
              city: 'Dhaka',
              province: 'Dhaka Division',
              postalCode: '1200',
              country: 'Bangladesh',
              isDefault: true,
            },
          ],
        },
      },
      { upsert: true, new: true }
    );

    const userB = await User.findOneAndUpdate(
      { email: 'wallet_customer_b@demo.com' },
      {
        $set: {
          name: 'Wallet Customer B',
          email: 'wallet_customer_b@demo.com',
          role: 'customer',
          addresses: [
            {
              label: 'Home',
              line1: '456 Other Street',
              city: 'Dhaka',
              province: 'Dhaka Division',
              postalCode: '1200',
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

    // Prepare a test product
    const product = await Product.findOneAndUpdate(
      { slug: 'wallet-test-silk-shirt' },
      {
        $set: {
          name: 'Wallet Test Silk Shirt',
          slug: 'wallet-test-silk-shirt',
          description: 'A test shirt for wallet points testing',
          category: new mongoose.Types.ObjectId(),
          basePrice: 500,
          discountPrice: null,
          images: ['https://placehold.co/400x400'],
          variants: [
            {
              size: 'M',
              color: 'Blue',
              material: 'Silk',
              sku: 'P421-SILK-M',
              stock: 100,
            },
          ],
          status: 'active',
        },
      },
      { upsert: true, new: true }
    );

    const initialStock = product.variants[0].stock;

    // Helper to create an order
    async function createTestOrder(userId: mongoose.Types.ObjectId, total: number = 1060, status: any = 'pending_payment') {
      const order = await Order.create({
        user: userId,
        items: [
          {
            product: product._id,
            name: product.name,
            image: product.images[0],
            variantSku: product.variants[0].sku,
            size: product.variants[0].size,
            color: product.variants[0].color,
            unitPrice: 500,
            quantity: 2,
          },
        ],
        shippingAddress: {
          line1: '123 Test Street',
          city: 'Dhaka',
          province: 'Dhaka Division',
          postalCode: '1200',
          country: 'Bangladesh',
        },
        subtotal: 1000,
        shippingFee: total - 1000 > 0 ? total - 1000 : 0,
        discountAmount: 0,
        total,
        status,
        pointsPaid: 0,
      });
      return order;
    }

    // TEST 1: Unauthenticated request (401)
    console.log('--- TEST 1: Unauthenticated request (401) ---');
    const res1 = await request('POST', `/api/orders/507f1f77bcf86cd799439011/payment/wallet`);
    assert(res1.status === 401, 'Returns 401 when no auth cookie is provided');

    // TEST 2: Invalid order ID format (400)
    console.log('\n--- TEST 2: Invalid order ID format (400) ---');
    const res2 = await request('POST', `/api/orders/not-a-valid-id/payment/wallet`, {}, cookieA);
    assert(res2.status === 400, 'Returns 400 for invalid ObjectId string');

    // TEST 3: Order not found (404)
    console.log('\n--- TEST 3: Order not found (404) ---');
    const res3 = await request('POST', `/api/orders/${new mongoose.Types.ObjectId()}/payment/wallet`, {}, cookieA);
    assert(res3.status === 404, 'Returns 404 when order does not exist');

    // TEST 4: Non-owner access (403)
    console.log('\n--- TEST 4: Non-owner access (403) ---');
    const orderA = await createTestOrder(userA._id, 1060);
    const res4 = await request('POST', `/api/orders/${orderA._id}/payment/wallet`, {}, cookieB);
    assert(res4.status === 403, 'Returns 403 when User B attempts to pay for User A order');

    // TEST 5: Zero or negative total rejection (400)
    console.log('\n--- TEST 5: Zero or negative total order (400) ---');
    const orderZero = await createTestOrder(userA._id, 0);
    const res5 = await request('POST', `/api/orders/${orderZero._id}/payment/wallet`, {}, cookieA);
    assert(res5.status === 400, 'Returns 400 for order with total <= 0');

    // TEST 6: Cancelled order rejection (400)
    console.log('\n--- TEST 6: Cancelled order rejection (400) ---');
    const orderCancelled = await createTestOrder(userA._id, 1060, 'cancelled');
    const res6 = await request('POST', `/api/orders/${orderCancelled._id}/payment/wallet`, {}, cookieA);
    assert(res6.status === 400, 'Returns 400 when order is not pending_payment');

    // TEST 7: Insufficient points balance (400)
    console.log('\n--- TEST 7: Insufficient reward points balance (400) ---');
    // Ensure User A wallet has 0 points
    await Wallet.findOneAndUpdate(
      { user: userA._id },
      { $set: { balancePoints: 0, lifetimeSpentPoints: 0, lifetimeEarnedPoints: 0, active: true } },
      { upsert: true }
    );
    const res7 = await request('POST', `/api/orders/${orderA._id}/payment/wallet`, {}, cookieA);
    assert(res7.status === 400, 'Returns 400 for insufficient points balance');
    assert(res7.body.message?.includes('Insufficient') || res7.body.error?.includes('Insufficient'), 'Error message mentions insufficient reward points balance');

    const freshOrderA = await Order.findById(orderA._id);
    assert(freshOrderA?.status === 'pending_payment', 'Order status remains pending_payment on failure');
    assert(freshOrderA?.pointsPaid === 0, 'Order pointsPaid remains 0 on failure');

    const paymentAfterFail = await Payment.findOne({ order: orderA._id });
    assert(!paymentAfterFail, 'No Payment document created on insufficient balance');

    // Stock check
    const productAfterFail = await Product.findById(product._id);
    assert(productAfterFail?.variants[0].stock === initialStock, 'Stock remains unchanged after failed payment');

    // TEST 8: Successful wallet payment (200)
    console.log('\n--- TEST 8: Successful full wallet points payment (200) ---');
    // Order total is 1060. Required points = 1060 / 0.01 = 106,000 points.
    // Credit User A with 200,000 points
    await walletService.credit({
      userId: userA._id,
      points: 200000,
      type: 'admin_credit',
      idempotencyKey: `seed_credit_${Date.now()}`,
      note: 'Test seed credit for P42.1',
    });

    const res8 = await request('POST', `/api/orders/${orderA._id}/payment/wallet`, {}, cookieA);
    assert(res8.status === 200, 'Returns 200 on successful payment');
    assert(res8.body.success === true, 'Response has success: true');
    assert(res8.body.data.pointsDeducted === 106000, 'Deducted points is exactly 106,000 (total 1060 / 0.01)');
    assert(res8.body.data.order.status === 'confirmed', 'Returned order status is confirmed');
    assert(res8.body.data.order.pointsPaid === 106000, 'Returned order pointsPaid is 106,000');
    assert(res8.body.data.payment.status === 'approved', 'Returned payment status is approved');
    assert(res8.body.data.payment.method === 'reward_points', 'Returned payment method is reward_points');

    // DB Verifications
    const dbOrder = await Order.findById(orderA._id);
    assert(dbOrder?.status === 'confirmed', 'DB Order status is confirmed');
    assert(dbOrder?.pointsPaid === 106000, 'DB Order pointsPaid is 106000');

    const dbPayment = await Payment.findOne({ order: orderA._id });
    assert(dbPayment !== null, 'DB Payment document exists');
    assert(dbPayment?.method === 'reward_points', 'DB Payment method is reward_points');
    assert(dbPayment?.status === 'approved', 'DB Payment status is approved');
    assert(dbPayment?.amount === 1060, 'DB Payment amount equals order total 1060');
    assert(dbPayment?.pointsUsed === 106000, 'DB Payment pointsUsed is 106000');
    assert(dbPayment?.walletTransaction !== null, 'DB Payment has walletTransaction reference');

    const dbTx = await PointsTransaction.findById(dbPayment?.walletTransaction);
    assert(dbTx !== null, 'PointsTransaction ledger entry exists');
    assert(dbTx?.type === 'order_spend', 'PointsTransaction type is order_spend');
    assert(dbTx?.direction === 'debit', 'PointsTransaction direction is debit');
    assert(dbTx?.points === 106000, 'PointsTransaction points is 106000');
    assert(dbTx?.order?.toString() === orderA._id.toString(), 'PointsTransaction references the order');

    const dbWallet = await Wallet.findOne({ user: userA._id });
    assert(dbWallet?.balancePoints === 94000, 'Wallet balance reduced from 200,000 to 94,000');
    assert(dbWallet?.lifetimeSpentPoints === 106000, 'Wallet lifetimeSpentPoints increased to 106,000');

    // Verify stock was not touched by payment
    const dbProduct = await Product.findById(product._id);
    assert(dbProduct?.variants[0].stock === initialStock, 'Stock remains exactly unchanged by payment step');

    // TEST 9: Idempotency replay (200)
    console.log('\n--- TEST 9: Idempotent replay ---');
    const res9 = await request('POST', `/api/orders/${orderA._id}/payment/wallet`, {}, cookieA);
    assert(res9.status === 200, 'Returns 200 on repeated request');
    assert(res9.body.success === true, 'Returns success: true on replay');
    assert(res9.body.data.pointsDeducted === 106000, 'Returns same pointsDeducted on replay');

    const walletAfterReplay = await Wallet.findOne({ user: userA._id });
    assert(walletAfterReplay?.balancePoints === 94000, 'Wallet was NOT debited a second time');

    const txCount = await PointsTransaction.countDocuments({ order: orderA._id });
    assert(txCount === 1, 'Only 1 PointsTransaction exists for the order (no double-entry)');

    // TEST 10: Upsert over prior rejected payment
    console.log('\n--- TEST 10: Upsert over prior rejected bank_transfer payment ---');
    const orderWithRejectedPayment = await createTestOrder(userA._id, 500);
    // User A currently has 94,000 points. 500 total requires 50,000 points.
    // Manually create a prior rejected bank_transfer payment for this order
    await Payment.create({
      order: orderWithRejectedPayment._id,
      method: 'bank_transfer',
      amount: 500,
      status: 'rejected',
      slipImageUrl: 'https://example.com/rejected_slip.jpg',
    });

    const res10 = await request('POST', `/api/orders/${orderWithRejectedPayment._id}/payment/wallet`, {}, cookieA);
    assert(res10.status === 200, 'Returns 200 when paying order with existing rejected payment');
    assert(res10.body.data.pointsDeducted === 50000, 'Points deducted is 50,000 (total 500 / 0.01)');

    const paymentsForOrder = await Payment.find({ order: orderWithRejectedPayment._id });
    assert(paymentsForOrder.length === 1, 'Exactly one Payment document exists (upserted, no duplicate key error)');
    assert(paymentsForOrder[0].method === 'reward_points', 'Payment method updated to reward_points');
    assert(paymentsForOrder[0].status === 'approved', 'Payment status updated to approved');
    assert(paymentsForOrder[0].pointsUsed === 50000, 'Payment pointsUsed updated to 50000');
    assert(paymentsForOrder[0].slipImageUrl === null, 'Pre-hook cleared slipImageUrl for reward_points method');

    const finalOrder = await Order.findById(orderWithRejectedPayment._id);
    assert(finalOrder?.status === 'confirmed', 'Order transitioned to confirmed');
    assert(finalOrder?.pointsPaid === 50000, 'Order pointsPaid is 50000');

    console.log('\n====================================================');
    console.log(`P42.1 VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

run();
