import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './src/models/User';
import { Wallet } from './src/models/Wallet';
import { PointsTransaction } from './src/models/PointsTransaction';
import { walletService } from './src/services/wallet.service';
import {
  POINT_VALUE,
  REFUND_POINTS_PER_CURRENCY_UNIT,
} from './src/constants/rewardPoints';

dotenv.config();

function request(
  method: string,
  path: string,
  body?: any,
  cookie?: string
): Promise<{ status: number; body: any; setCookie?: string[] }> {
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
          const setCookie = res.headers['set-cookie'];
          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode || 500, body: parsed, setCookie });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function getCookieHeader(res: { setCookie?: string[] }): string {
  return res.setCookie ? res.setCookie[0].split(';')[0] : '';
}

async function run() {
  console.log('====================================================');
  console.log('   RUNNING P37.1 REWARD POINTS WALLET VERIFICATION   ');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/shop';
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
    // 0. Clean up or prepare test users
    const testEmail = `wallet_test_${Date.now()}@example.com`;
    const adminEmail = `wallet_admin_${Date.now()}@example.com`;
    const password = 'Password123!';

    await request('POST', '/api/auth/register', {
      name: 'Wallet Tester',
      email: testEmail,
      password,
    });
    const testUser = await User.findOne({ email: testEmail });
    if (!testUser) throw new Error('Failed to create test customer user');

    await request('POST', '/api/auth/register', {
      name: 'Wallet Admin',
      email: adminEmail,
      password,
    });
    const adminUser = await User.findOne({ email: adminEmail });
    if (!adminUser) throw new Error('Failed to create test admin user');
    adminUser.role = 'admin';
    await adminUser.save();

    console.log(`Created test users: customer (${testUser._id}), admin (${adminUser._id})\n`);

    // TEST 1: Service - Constants check
    console.log('--- TEST 1: Reward points constants ---');
    assert(POINT_VALUE === 0.01, 'POINT_VALUE is 0.01');
    assert(REFUND_POINTS_PER_CURRENCY_UNIT === 100, 'REFUND_POINTS_PER_CURRENCY_UNIT is 100');

    // TEST 2: Service - currencyToPoints
    console.log('\n--- TEST 2: currencyToPoints calculation ---');
    assert(walletService.currencyToPoints(100) === 10000, '100 currency units = 10000 points');
    assert(walletService.currencyToPoints(12.34) === 1234, '12.34 currency units = 1234 points');
    assert(walletService.currencyToPoints(10.001) === 1001, '10.001 ceiling = 1001 points');

    // TEST 3: Service - calculateRefundPoints
    console.log('\n--- TEST 3: calculateRefundPoints proportional discount ---');
    // Order: subtotal 200, discount 50 (25% discount rate)
    // Returned items: 1 item of 100
    // Proportional discount: 100 * (50 / 200) = 25
    // Refund currency: 100 - 25 = 75
    // Refund points: 75 * 100 = 7500
    const refundPts1 = walletService.calculateRefundPoints(
      { subtotal: 200, discountAmount: 50 },
      [{ unitPrice: 100, quantity: 1 }]
    );
    assert(refundPts1 === 7500, `Expected 7500 refund points, got ${refundPts1}`);

    // Order without discount: subtotal 100, discount 0
    // Returned items: 1 item of 50
    // Refund currency: 50
    // Refund points: 50 * 100 = 5000
    const refundPts2 = walletService.calculateRefundPoints(
      { subtotal: 100, discountAmount: 0 },
      [{ unitPrice: 50, quantity: 1 }]
    );
    assert(refundPts2 === 5000, `Expected 5000 refund points, got ${refundPts2}`);

    // TEST 4: Service - Credit 1000 points
    console.log('\n--- TEST 4: Service credit ---');
    const creditKey1 = `test-credit-1-${Date.now()}`;
    const creditRes = await walletService.credit({
      userId: testUser._id,
      points: 1000,
      type: 'refund_earn',
      idempotencyKey: creditKey1,
      note: 'Initial refund earn test',
    });

    assert(creditRes.wallet.balancePoints === 1000, 'Wallet balancePoints is 1000');
    assert(creditRes.wallet.lifetimeEarnedPoints === 1000, 'lifetimeEarnedPoints is 1000');
    assert(creditRes.wallet.lifetimeSpentPoints === 0, 'lifetimeSpentPoints is 0');
    assert(creditRes.transaction.direction === 'credit', 'Transaction direction is credit');
    assert(creditRes.transaction.balanceAfter === 1000, 'Transaction balanceAfter matches wallet balance (1000)');
    assert(creditRes.transaction.type === 'refund_earn', 'Transaction type is refund_earn');

    // TEST 5: Service - Idempotency
    console.log('\n--- TEST 5: Idempotency on credit ---');
    const dupCreditRes = await walletService.credit({
      userId: testUser._id,
      points: 1000,
      type: 'refund_earn',
      idempotencyKey: creditKey1, // Duplicate key!
      note: 'Duplicate credit call',
    });

    assert(
      dupCreditRes.transaction._id.toString() === creditRes.transaction._id.toString(),
      'Duplicate credit returned existing transaction'
    );
    assert(dupCreditRes.wallet.balancePoints === 1000, 'Wallet balance unchanged at 1000 (no double-credit)');

    const txCountForKey1 = await PointsTransaction.countDocuments({ idempotencyKey: creditKey1 });
    assert(txCountForKey1 === 1, 'Exactly one transaction exists for idempotencyKey');

    // TEST 6: Service - Debit 300 points
    console.log('\n--- TEST 6: Service debit ---');
    const debitKey1 = `test-debit-1-${Date.now()}`;
    const debitRes = await walletService.debit({
      userId: testUser._id,
      points: 300,
      type: 'order_spend',
      idempotencyKey: debitKey1,
      note: 'Order checkout spend',
    });

    assert(debitRes.wallet.balancePoints === 700, 'Wallet balance is 700 after debiting 300');
    assert(debitRes.wallet.lifetimeSpentPoints === 300, 'lifetimeSpentPoints is 300');
    assert(debitRes.transaction.direction === 'debit', 'Transaction direction is debit');
    assert(debitRes.transaction.balanceAfter === 700, 'Transaction balanceAfter matches 700');

    // TEST 7: Service - Floor guard (Debit exceeding balance)
    console.log('\n--- TEST 7: Floor guard rejects overdraft ---');
    let threwFloor = false;
    try {
      await walletService.debit({
        userId: testUser._id,
        points: 800, // 800 > 700
        type: 'order_spend',
        idempotencyKey: `test-overdraft-${Date.now()}`,
      });
    } catch (err: any) {
      threwFloor = true;
      assert(err.statusCode === 400, `Floor guard threw 400 (got ${err.statusCode})`);
    }
    assert(threwFloor, 'Overdraft attempt threw error');

    const walletAfterFloor = await Wallet.findOne({ user: testUser._id });
    assert(walletAfterFloor?.balancePoints === 700, 'Wallet balance remains 700 after rejected debit');

    // TEST 8: canPayOrderWithPoints
    console.log('\n--- TEST 8: canPayOrderWithPoints ---');
    // Balance is 700 points = ৳7.00
    const canPay5 = await walletService.canPayOrderWithPoints(testUser._id, 5); // 500 points needed
    assert(canPay5 === true, 'Can pay ৳5 order with 700 points balance (needs 500)');
    const canPay10 = await walletService.canPayOrderWithPoints(testUser._id, 10); // 1000 points needed
    assert(canPay10 === false, 'Cannot pay ৳10 order with 700 points balance (needs 1000)');

    // Login users for HTTP integration tests
    console.log('\n--- Authenticating users for API tests ---');
    const custLoginRes = await request('POST', '/api/auth/login', {
      email: testEmail,
      password: 'Password123!',
    });
    const custCookie = getCookieHeader(custLoginRes);

    const adminLoginRes = await request('POST', '/api/auth/login', {
      email: adminEmail,
      password: 'Password123!',
    });
    const adminCookie = getCookieHeader(adminLoginRes);

    // TEST 9: HTTP - Customer GET /api/wallet/me
    console.log('\n--- TEST 9: Customer GET /api/wallet/me ---');
    const unauthMe = await request('GET', '/api/wallet/me');
    assert(unauthMe.status === 401, 'Unauthenticated GET /api/wallet/me returns 401');

    const authMe = await request('GET', '/api/wallet/me', undefined, custCookie);
    assert(authMe.status === 200, 'Authenticated GET /api/wallet/me returns 200');
    assert(authMe.body.success === true, 'Response has success: true');
    assert(authMe.body.data.balancePoints === 700, 'Returns correct balancePoints 700');

    // TEST 10: HTTP - Customer GET /api/wallet/me/transactions
    console.log('\n--- TEST 10: Customer GET /api/wallet/me/transactions ---');
    const authTx = await request('GET', '/api/wallet/me/transactions?page=1&limit=10', undefined, custCookie);
    assert(authTx.status === 200, 'GET /api/wallet/me/transactions returns 200');
    assert(authTx.body.data.results.length === 2, `Found 2 ledger records (credit + debit) (got ${authTx.body.data.results.length})`);
    assert(authTx.body.data.total === 2, 'Total is 2');
    assert(authTx.body.data.page === 1, 'Page is 1');

    // TEST 11: HTTP - Admin adjust wallet (Credit)
    console.log('\n--- TEST 11: Admin adjust wallet (Credit) ---');
    const adminCreditRes = await request(
      'POST',
      `/api/admin/wallets/${testUser._id}/adjust`,
      {
        direction: 'credit',
        points: 500,
        reason: 'Customer goodwill credit',
      },
      adminCookie
    );
    assert(adminCreditRes.status === 200, 'Admin adjust credit returns 200');
    assert(adminCreditRes.body.data.wallet.balancePoints === 1200, 'Wallet balance updated to 1200');
    assert(adminCreditRes.body.data.transaction.direction === 'credit', 'Transaction recorded as credit');
    assert(adminCreditRes.body.data.transaction.balanceAfter === 1200, 'Transaction balanceAfter is 1200');

    // TEST 12: HTTP - Admin adjust wallet (Debit)
    console.log('\n--- TEST 12: Admin adjust wallet (Debit) ---');
    const adminDebitRes = await request(
      'POST',
      `/api/admin/wallets/${testUser._id}/adjust`,
      {
        direction: 'debit',
        points: 200,
        reason: 'Correction debit',
      },
      adminCookie
    );
    assert(adminDebitRes.status === 200, 'Admin adjust debit returns 200');
    assert(adminDebitRes.body.data.wallet.balancePoints === 1000, 'Wallet balance updated to 1000');
    assert(adminDebitRes.body.data.transaction.balanceAfter === 1000, 'Transaction balanceAfter is 1000');

    // TEST 13: HTTP - Admin adjust wallet (Overdraft debit rejected)
    console.log('\n--- TEST 13: Admin adjust wallet overdraft rejection ---');
    const adminOverdraftRes = await request(
      'POST',
      `/api/admin/wallets/${testUser._id}/adjust`,
      {
        direction: 'debit',
        points: 5000, // 5000 > 1000
        reason: 'Excessive debit',
      },
      adminCookie
    );
    assert(adminOverdraftRes.status === 400, 'Admin overdraft debit rejected with 400');

    // TEST 14: HTTP - Admin GET /api/admin/wallets
    console.log('\n--- TEST 14: Admin GET /api/admin/wallets ---');
    const adminWalletsRes = await request('GET', '/api/admin/wallets?page=1&limit=10', undefined, adminCookie);
    assert(adminWalletsRes.status === 200, 'Admin GET /api/admin/wallets returns 200');
    assert(Array.isArray(adminWalletsRes.body.data.results), 'results is an array');
    assert(typeof adminWalletsRes.body.data.total === 'number', 'total is a number');

    // Non-admin customer forbidden from admin endpoints
    const custAdminAttempt = await request('GET', '/api/admin/wallets', undefined, custCookie);
    assert(custAdminAttempt.status === 403, 'Customer forbidden from /api/admin/wallets (403)');

    // TEST 15: Single wallet invariant
    console.log('\n--- TEST 15: Single wallet per user invariant ---');
    const allWalletsForUser = await Wallet.find({ user: testUser._id });
    assert(allWalletsForUser.length === 1, 'Exactly one Wallet document exists for user');

    // Clean up test users & wallets
    await PointsTransaction.deleteMany({ user: { $in: [testUser._id, adminUser._id] } });
    await Wallet.deleteMany({ user: { $in: [testUser._id, adminUser._id] } });
    await User.deleteMany({ _id: { $in: [testUser._id, adminUser._id] } });
    console.log('\nCleaned up test data.');
  } finally {
    await mongoose.disconnect();
  }

  console.log('\n====================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
