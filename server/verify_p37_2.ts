import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './src/models/User';
import { Wallet } from './src/models/Wallet';
import { PointsTransaction } from './src/models/PointsTransaction';
import { walletService } from './src/services/wallet.service';

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
  console.log('       RUNNING P37.2 CUSTOMER WALLET UI TESTS       ');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/shop';
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
    const custEmail1 = `p37_2_cust1_${Date.now()}@example.com`;
    const custEmail2 = `p37_2_cust2_${Date.now()}@example.com`;
    const adminEmail = `p37_2_admin_${Date.now()}@example.com`;
    const password = 'Password123!';

    // TEST 1: Guest Access Guard
    console.log('--- TEST 1: Unauthenticated Guest Access Guard ---');
    const guestRes = await request('GET', '/api/wallet/me');
    assert(guestRes.status === 401, 'Guest request to /api/wallet/me is rejected with 401');

    const guestTxRes = await request('GET', '/api/wallet/me/transactions');
    assert(guestTxRes.status === 401, 'Guest request to /api/wallet/me/transactions is rejected with 401');

    // Register Customer 1
    await request('POST', '/api/auth/register', {
      name: 'Customer One',
      email: custEmail1,
      password,
    });
    const user1 = await User.findOne({ email: custEmail1 });
    if (!user1) throw new Error('Failed to create Customer 1');

    // Register Customer 2 (for isolation test)
    await request('POST', '/api/auth/register', {
      name: 'Customer Two',
      email: custEmail2,
      password,
    });
    const user2 = await User.findOne({ email: custEmail2 });
    if (!user2) throw new Error('Failed to create Customer 2');

    // Register Admin
    await request('POST', '/api/auth/register', {
      name: 'Admin User',
      email: adminEmail,
      password,
    });
    const adminUser = await User.findOne({ email: adminEmail });
    if (!adminUser) throw new Error('Failed to create Admin');
    adminUser.role = 'admin';
    await adminUser.save();

    // Login Customer 1
    const loginRes1 = await request('POST', '/api/auth/login', {
      email: custEmail1,
      password,
    });
    const cust1Cookie = getCookieHeader(loginRes1);

    // Login Customer 2
    const loginRes2 = await request('POST', '/api/auth/login', {
      email: custEmail2,
      password,
    });
    const cust2Cookie = getCookieHeader(loginRes2);

    // Login Admin
    const loginAdminRes = await request('POST', '/api/auth/login', {
      email: adminEmail,
      password,
    });
    const adminCookie = getCookieHeader(loginAdminRes);

    // TEST 2: Customer with no wallet activity shows 0 balance and empty transactions
    console.log('\n--- TEST 2: Zero Balance & Empty State for Fresh Customer ---');
    const freshWalletRes = await request('GET', '/api/wallet/me', undefined, cust1Cookie);
    assert(freshWalletRes.status === 200, 'GET /api/wallet/me returns 200');
    assert(freshWalletRes.body.data.balancePoints === 0, 'Initial balancePoints is 0');
    assert(freshWalletRes.body.data.lifetimeEarnedPoints === 0, 'Initial lifetimeEarnedPoints is 0');
    assert(freshWalletRes.body.data.lifetimeSpentPoints === 0, 'Initial lifetimeSpentPoints is 0');

    const freshTxRes = await request('GET', '/api/wallet/me/transactions', undefined, cust1Cookie);
    assert(freshTxRes.status === 200, 'GET /api/wallet/me/transactions returns 200');
    assert(freshTxRes.body.data.results.length === 0, 'Transactions results array is empty');
    assert(freshTxRes.body.data.total === 0, 'Total transactions count is 0');

    // TEST 3: Admin Credit and Refresh (Live Update)
    console.log('\n--- TEST 3: Admin Credit Updates Customer Balance & Ledger ---');
    const creditAmount = 2500;
    const adminAdjustRes = await request(
      'POST',
      `/api/admin/wallets/${user1._id}/adjust`,
      {
        direction: 'credit',
        points: creditAmount,
        reason: 'VIP Reward Points Bonus',
      },
      adminCookie
    );
    assert(adminAdjustRes.status === 200, 'Admin adjust credit returns 200');
    assert(adminAdjustRes.body.data.wallet.balancePoints === creditAmount, `Balance is now ${creditAmount}`);

    // Customer re-fetches wallet (simulating page reload/refresh button)
    const updatedWalletRes = await request('GET', '/api/wallet/me', undefined, cust1Cookie);
    assert(updatedWalletRes.status === 200, 'Customer re-fetches wallet with 200');
    assert(updatedWalletRes.body.data.balancePoints === 2500, 'Customer wallet reflects 2500 balance points');
    assert(updatedWalletRes.body.data.lifetimeEarnedPoints === 2500, 'lifetimeEarnedPoints reflects 2500');

    const updatedTxRes = await request('GET', '/api/wallet/me/transactions', undefined, cust1Cookie);
    assert(updatedTxRes.status === 200, 'Customer re-fetches transactions with 200');
    assert(updatedTxRes.body.data.results.length === 1, 'Transaction ledger has 1 row');
    assert(updatedTxRes.body.data.results[0].direction === 'credit', 'Transaction direction is credit');
    assert(updatedTxRes.body.data.results[0].points === 2500, 'Transaction points is 2500');
    assert(updatedTxRes.body.data.results[0].balanceAfter === 2500, 'Transaction balanceAfter is 2500');
    assert(updatedTxRes.body.data.results[0].note === 'VIP Reward Points Bonus', 'Transaction note matches');

    // TEST 4: Ledger Isolation (Customer 2 cannot see Customer 1's transactions)
    console.log('\n--- TEST 4: Customer Ledger Isolation ---');
    const cust2TxRes = await request('GET', '/api/wallet/me/transactions', undefined, cust2Cookie);
    assert(cust2TxRes.status === 200, 'Customer 2 GET /api/wallet/me/transactions returns 200');
    assert(cust2TxRes.body.data.results.length === 0, "Customer 2 cannot see Customer 1's transaction (isolation verified)");

    const cust2WalletRes = await request('GET', '/api/wallet/me', undefined, cust2Cookie);
    assert(cust2WalletRes.body.data.balancePoints === 0, 'Customer 2 balance is 0');

    // TEST 5: Customer Debit & Running Balance
    console.log('\n--- TEST 5: Customer Debit & Running Balance Ledger Row ---');
    await walletService.debit({
      userId: user1._id,
      points: 500,
      type: 'order_spend',
      idempotencyKey: `p37_2_debit_${Date.now()}`,
      note: 'Checkout redemption',
    });

    const postDebitWallet = await request('GET', '/api/wallet/me', undefined, cust1Cookie);
    assert(postDebitWallet.body.data.balancePoints === 2000, 'Balance after debit is 2000');
    assert(postDebitWallet.body.data.lifetimeSpentPoints === 500, 'lifetimeSpentPoints is 500');

    const postDebitTx = await request('GET', '/api/wallet/me/transactions', undefined, cust1Cookie);
    assert(postDebitTx.body.data.results.length === 2, 'Customer 1 has 2 ledger entries');
    assert(postDebitTx.body.data.results[0].direction === 'debit', 'Latest entry is debit');
    assert(postDebitTx.body.data.results[0].points === 500, 'Points debited is 500');
    assert(postDebitTx.body.data.results[0].balanceAfter === 2000, 'balanceAfter is 2000');

    // Clean up
    await PointsTransaction.deleteMany({ user: { $in: [user1._id, user2._id, adminUser._id] } });
    await Wallet.deleteMany({ user: { $in: [user1._id, user2._id, adminUser._id] } });
    await User.deleteMany({ _id: { $in: [user1._id, user2._id, adminUser._id] } });
    console.log('\n✔ Cleaned up test database records.');
  } finally {
    await mongoose.disconnect();
  }

  console.log('\n====================================================');
  console.log(`P37.2 VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
