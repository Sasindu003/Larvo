import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
import { Order } from './src/models/Order';
import { Payment } from './src/models/Payment';
import { User } from './src/models/User';
import { PointsTransaction } from './src/models/PointsTransaction';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/shop';

async function run() {
  console.log('====================================================');
  console.log('   RUNNING P38 ORDER & PAYMENT EXTENSION VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✔ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✖ FAIL: ${message}`);
      failed++;
    }
  }

  await mongoose.connect(MONGO_URI);
  console.log('✔ Connected to MongoDB.\n');

  try {
    // Setup dummy user
    let user = await User.findOne({ email: 'p38_tester@example.com' });
    if (!user) {
      user = await User.create({
        name: 'P38 Tester',
        email: 'p38_tester@example.com',
        password: 'Password123!',
        role: 'customer',
      });
    }

    // Helper to create valid Order doc
    async function createTestOrder(overrides: Record<string, any> = {}) {
      return await Order.create({
        user: user!._id,
        items: [
          {
            product: new Types.ObjectId(),
            name: 'Test Shirt',
            image: 'https://example.com/img.jpg',
            variantSku: `SKU-${Date.now()}-${Math.random()}`,
            size: 'M',
            color: 'Black',
            unitPrice: 50,
            quantity: 2,
          },
        ],
        shippingAddress: {
          line1: '123 Main St',
          city: 'City',
          province: 'Province',
          postalCode: '1234',
          country: 'Country',
        },
        subtotal: 100,
        shippingFee: 10,
        total: 110,
        ...overrides,
      });
    }

    // ── TEST 1: Order pointsPaid defaults to 0 and enforces min 0 ──
    console.log('--- TEST 1: Order pointsPaid field ---');
    const order1 = await createTestOrder();
    assert(order1.pointsPaid === 0, 'Order.pointsPaid defaults to 0');

    let orderValidationFailed = false;
    try {
      await createTestOrder({ pointsPaid: -10 });
    } catch (err: any) {
      orderValidationFailed = true;
    }
    assert(orderValidationFailed, 'Order.pointsPaid enforces min 0 constraint');

    // ── TEST 2: Payment reward_points method with pointsUsed & walletTransaction ──
    console.log('\n--- TEST 2: Payment reward_points method ---');
    const order2 = await createTestOrder();
    const dummyWalletTx = new Types.ObjectId();
    const pReward = await Payment.create({
      order: order2._id,
      method: 'reward_points',
      amount: 0,
      status: 'approved',
      pointsUsed: 11000,
      walletTransaction: dummyWalletTx,
    });
    assert(pReward.method === 'reward_points', 'Payment.method is reward_points');
    assert(pReward.pointsUsed === 11000, 'Payment.pointsUsed persists correctly for reward_points');
    assert(
      pReward.walletTransaction?.toString() === dummyWalletTx.toString(),
      'Payment.walletTransaction persists correctly for reward_points'
    );

    // ── TEST 3: Payment bank_transfer strips pointsUsed and walletTransaction ──
    console.log('\n--- TEST 3: bank_transfer strips pointsUsed and walletTransaction ---');
    const order3 = await createTestOrder();
    const pBank = await Payment.create({
      order: order3._id,
      method: 'bank_transfer',
      amount: 110,
      status: 'submitted',
      pointsUsed: 500,
      walletTransaction: dummyWalletTx,
    });
    assert(pBank.method === 'bank_transfer', 'Payment.method is bank_transfer');
    assert(pBank.pointsUsed === null, 'Payment.pointsUsed is stripped to null for bank_transfer');
    assert(pBank.walletTransaction === null, 'Payment.walletTransaction is stripped to null for bank_transfer');

    // ── TEST 4: Unique index prevents duplicate Payment for same order ──
    console.log('\n--- TEST 4: Unique index on Payment.order ---');
    // Ensure unique index is built in Mongo
    await Payment.init();
    let dupFailed = false;
    try {
      await Payment.create({
        order: order3._id,
        method: 'simulated_online',
        amount: 110,
        status: 'submitted',
      });
    } catch (err: any) {
      if (err.code === 11000 || err.name === 'MongoServerError') {
        dupFailed = true;
      }
    }
    assert(dupFailed, 'Duplicate Payment creation against same order throws E11000 duplicate key error');

    // ── TEST 5: findOneAndUpdate with upsert replaces rejected attempt without E11000 ──
    console.log('\n--- TEST 5: Upsert payment retry pattern ---');
    const order5 = await createTestOrder();
    // Step A: First attempt rejected
    await Payment.findOneAndUpdate(
      { order: order5._id },
      {
        order: order5._id,
        method: 'bank_transfer',
        slipImageUrl: 'https://example.com/bad-slip.jpg',
        amount: 110,
        status: 'rejected',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const check1 = await Payment.find({ order: order5._id });
    assert(check1.length === 1, 'Initial rejected payment created (count = 1)');
    assert(check1[0].status === 'rejected', 'Initial payment is rejected');
    assert(check1[0].method === 'bank_transfer', 'Initial payment method is bank_transfer');

    // Step B: Retry payment via reward_points using findOneAndUpdate upsert
    const updatedPayment = await Payment.findOneAndUpdate(
      { order: order5._id },
      {
        method: 'reward_points',
        slipImageUrl: null,
        amount: 0,
        status: 'approved',
        pointsUsed: 11000,
        walletTransaction: dummyWalletTx,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    assert(updatedPayment?.method === 'reward_points', 'Retried payment method became reward_points');
    assert(updatedPayment?.status === 'approved', 'Retried payment status became approved');
    assert(updatedPayment?.pointsUsed === 11000, 'Retried payment has pointsUsed set');

    const check2 = await Payment.find({ order: order5._id });
    assert(check2.length === 1, 'Still exactly one Payment document for the order after retry');

    // Step C: If retrying from reward_points to simulated_online via findOneAndUpdate, points fields are stripped
    const retriedOnline = await Payment.findOneAndUpdate(
      { order: order5._id },
      {
        method: 'simulated_online',
        transactionId: 'TXN-12345',
        amount: 110,
        status: 'approved',
        pointsUsed: 9999, // Should be stripped by pre hook
        walletTransaction: dummyWalletTx,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    assert(retriedOnline?.method === 'simulated_online', 'Updated method to simulated_online');
    assert(retriedOnline?.pointsUsed === null, 'findOneAndUpdate hook stripped pointsUsed for simulated_online');
    assert(retriedOnline?.walletTransaction === null, 'findOneAndUpdate hook stripped walletTransaction for simulated_online');

    // ── TEST 6: PointsUsed min constraint (< 0 fails) ──
    console.log('\n--- TEST 6: Payment.pointsUsed validation ---');
    let negPointsFailed = false;
    try {
      await Payment.create({
        order: new Types.ObjectId(),
        method: 'reward_points',
        amount: 10,
        status: 'submitted',
        pointsUsed: -5,
      });
    } catch (err: any) {
      negPointsFailed = true;
    }
    assert(negPointsFailed, 'Payment.pointsUsed rejects negative numbers');

    // Cleanup test data
    await Payment.deleteMany({ order: { $in: [order1._id, order2._id, order3._id, order5._id] } });
    await Order.deleteMany({ _id: { $in: [order1._id, order2._id, order3._id, order5._id] } });
    await User.deleteOne({ email: 'p38_tester@example.com' });
    console.log('\n✔ Test cleanup completed.');

  } catch (err) {
    console.error('Fatal error during verification:', err);
    failed++;
  } finally {
    await mongoose.disconnect();
    console.log('✔ Disconnected from MongoDB.\n');
  }

  console.log('====================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run();
