import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './src/models/User';
import { Wallet } from './src/models/Wallet';
import { PointsTransaction } from './src/models/PointsTransaction';

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
  console.log('    RUNNING P37.3 ADMIN WALLET MANAGEMENT TESTS    ');
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
    const password = 'Password123!';
    const ts = Date.now();
    const custEmail = `p37_3_cust_${ts}@example.com`;
    const staffEmail = `p37_3_staff_${ts}@example.com`;
    const adminEmail = `p37_3_admin_${ts}@example.com`;

    // 1. Create customer
    await request('POST', '/api/auth/register', {
      name: 'P37.3 Customer',
      email: custEmail,
      password,
    });
    const customer = await User.findOne({ email: custEmail });
    if (!customer) throw new Error('Failed to create customer');

    // 2. Create staff
    await request('POST', '/api/auth/register', {
      name: 'P37.3 Staff Member',
      email: staffEmail,
      password,
    });
    const staff = await User.findOne({ email: staffEmail });
    if (!staff) throw new Error('Failed to create staff');
    staff.role = 'staff';
    await staff.save();

    // 3. Create admin
    await request('POST', '/api/auth/register', {
      name: 'P37.3 Admin Member',
      email: adminEmail,
      password,
    });
    const admin = await User.findOne({ email: adminEmail });
    if (!admin) throw new Error('Failed to create admin');
    admin.role = 'admin';
    await admin.save();

    // Log in all 3 users
    const staffLoginRes = await request('POST', '/api/auth/login', {
      email: staffEmail,
      password,
    });
    const staffCookie = getCookieHeader(staffLoginRes);

    const adminLoginRes = await request('POST', '/api/auth/login', {
      email: adminEmail,
      password,
    });
    const adminCookie = getCookieHeader(adminLoginRes);

    // TEST 1: RBAC - Staff is forbidden from admin wallet endpoints
    console.log('--- TEST 1: Staff RBAC Rejection ---');
    const staffWalletsRes = await request('GET', '/api/admin/wallets', undefined, staffCookie);
    assert(staffWalletsRes.status === 403, 'Staff GET /api/admin/wallets rejected with 403');

    const staffAdjustRes = await request(
      'POST',
      `/api/admin/wallets/${customer._id}/adjust`,
      { direction: 'credit', points: 100, reason: 'Unauthorized staff attempt' },
      staffCookie
    );
    assert(staffAdjustRes.status === 403, 'Staff POST /api/admin/wallets/:userId/adjust rejected with 403');

    // TEST 2: Admin can access wallet list
    console.log('\n--- TEST 2: Admin Access & Search Filter ---');
    const adminWalletsRes = await request('GET', '/api/admin/wallets', undefined, adminCookie);
    assert(adminWalletsRes.status === 200, 'Admin GET /api/admin/wallets returns 200');
    assert(Array.isArray(adminWalletsRes.body.data.results), 'results is an array');

    const searchRes = await request(
      'GET',
      `/api/admin/wallets?q=${encodeURIComponent('P37.3 Customer')}`,
      undefined,
      adminCookie
    );
    assert(searchRes.status === 200, 'Search by customer name returns 200');
    assert(
      searchRes.body.data.results.some((w: any) => w.user?.email === custEmail),
      'Found customer in search results'
    );

    // TEST 3: Validation - Empty reason rejected
    console.log('\n--- TEST 3: Empty Reason Rejected ---');
    const emptyReasonRes = await request(
      'POST',
      `/api/admin/wallets/${customer._id}/adjust`,
      { direction: 'credit', points: 500, reason: '' },
      adminCookie
    );
    assert(emptyReasonRes.status === 422, 'Empty reason rejected with 422');

    const whitespaceReasonRes = await request(
      'POST',
      `/api/admin/wallets/${customer._id}/adjust`,
      { direction: 'credit', points: 500, reason: '   ' },
      adminCookie
    );
    assert(whitespaceReasonRes.status === 422, 'Whitespace-only reason rejected with 422');

    // TEST 4: Validation - Overdraft debit rejected
    console.log('\n--- TEST 4: Debit Exceeding Balance Rejected ---');
    const overdraftRes = await request(
      'POST',
      `/api/admin/wallets/${customer._id}/adjust`,
      { direction: 'debit', points: 1000, reason: 'Attempted overdraft' },
      adminCookie
    );
    assert(overdraftRes.status === 400, 'Overdraft debit rejected with 400');
    assert(
      overdraftRes.body.message === 'Insufficient reward points balance',
      'Returns "Insufficient reward points balance" message'
    );

    // Verify balance is still 0
    const walletCheck1 = await Wallet.findOne({ user: customer._id });
    assert((walletCheck1?.balancePoints ?? 0) === 0, 'Customer balance remains 0 after failed debit');

    // TEST 5: Admin Credit with Reason
    console.log('\n--- TEST 5: Admin Credit Adjustment ---');
    const creditRes = await request(
      'POST',
      `/api/admin/wallets/${customer._id}/adjust`,
      {
        direction: 'credit',
        points: 1200,
        reason: 'Customer goodwill credit for shipping delay',
      },
      adminCookie
    );
    assert(creditRes.status === 200, 'Admin credit returns 200');
    assert(creditRes.body.data.wallet.balancePoints === 1200, 'Wallet balance updated to 1200');
    assert(creditRes.body.data.transaction.direction === 'credit', 'Transaction direction is credit');
    assert(creditRes.body.data.transaction.points === 1200, 'Transaction points is 1200');
    assert(creditRes.body.data.transaction.balanceAfter === 1200, 'Transaction balanceAfter is 1200');
    assert(
      creditRes.body.data.transaction.note === 'Customer goodwill credit for shipping delay',
      'Transaction note recorded properly'
    );

    // TEST 6: Admin Ledger Inspection
    console.log('\n--- TEST 6: Admin Ledger History Inspection ---');
    const ledgerRes = await request(
      'GET',
      `/api/admin/wallets/${customer._id}/transactions`,
      undefined,
      adminCookie
    );
    assert(ledgerRes.status === 200, 'Admin GET /api/admin/wallets/:userId/transactions returns 200');
    assert(ledgerRes.body.data.results.length === 1, 'Found 1 transaction row in ledger');
    assert(
      ledgerRes.body.data.results[0].type === 'admin_credit',
      'Transaction type recorded as admin_credit'
    );

    // TEST 7: Admin Debit with Reason
    console.log('\n--- TEST 7: Admin Debit Adjustment ---');
    const debitRes = await request(
      'POST',
      `/api/admin/wallets/${customer._id}/adjust`,
      {
        direction: 'debit',
        points: 400,
        reason: 'Correction of accidental duplicate credit',
      },
      adminCookie
    );
    assert(debitRes.status === 200, 'Admin debit returns 200');
    assert(debitRes.body.data.wallet.balancePoints === 800, 'Wallet balance updated to 800');
    assert(debitRes.body.data.transaction.direction === 'debit', 'Transaction direction is debit');
    assert(debitRes.body.data.transaction.points === 400, 'Transaction points is 400');
    assert(debitRes.body.data.transaction.balanceAfter === 800, 'Transaction balanceAfter is 800');

    // Re-check ledger row count
    const ledgerRes2 = await request(
      'GET',
      `/api/admin/wallets/${customer._id}/transactions`,
      undefined,
      adminCookie
    );
    assert(ledgerRes2.body.data.results.length === 2, 'Found 2 transaction rows in ledger (credit + debit)');

    // Clean up
    await PointsTransaction.deleteMany({ user: { $in: [customer._id, staff._id, admin._id] } });
    await Wallet.deleteMany({ user: { $in: [customer._id, staff._id, admin._id] } });
    await User.deleteMany({ _id: { $in: [customer._id, staff._id, admin._id] } });
    console.log('\n✔ Cleaned up test database records.');
  } finally {
    await mongoose.disconnect();
  }

  console.log('\n====================================================');
  console.log(`P37.3 VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
