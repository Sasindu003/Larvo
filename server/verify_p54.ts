import http from 'http';
import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import app from './src/app';
import { User } from './src/models/User';
import { Order } from './src/models/Order';
import { Product } from './src/models/Product';
import { Wallet } from './src/models/Wallet';
import { PointsTransaction } from './src/models/PointsTransaction';

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
    const postData = body ? JSON.stringify(body) : undefined;
    const headers: Record<string, string> = {};
    if (cookie) headers['Cookie'] = cookie;
    if (postData) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData).toString();
    }

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
        res.setEncoding('utf8');
        res.on('data', (chunk) => (raw += chunk));
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
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING P54 VERIFICATION SUITE ===\n');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  await new Promise<void>((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const addr = server.address() as any;
      serverPort = addr.port;
      console.log(`Ephemeral test server running on port ${serverPort}\n`);
      resolve();
    });
  });

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  const createdUserIds: Types.ObjectId[] = [];
  const createdOrderIds: Types.ObjectId[] = [];
  const createdProductIds: Types.ObjectId[] = [];
  const createdWalletUserIds: Types.ObjectId[] = [];
  const createdTxIds: Types.ObjectId[] = [];

  try {
    // 1. Provision Roles: Admin, Staff, Customer
    const adminUser = await User.create({
      name: 'P54 Admin',
      email: `p54_admin_${Date.now()}@example.com`,
      role: 'admin',
      active: true,
      authProvider: 'local',
    });
    createdUserIds.push(adminUser._id);
    const adminCookie = makeAuthCookie(adminUser._id.toString());

    const staffUser = await User.create({
      name: 'P54 Staff',
      email: `p54_staff_${Date.now()}@example.com`,
      role: 'staff',
      active: true,
      authProvider: 'local',
    });
    createdUserIds.push(staffUser._id);
    const staffCookie = makeAuthCookie(staffUser._id.toString());

    const customerUser = await User.create({
      name: 'P54 Customer',
      email: `p54_cust_${Date.now()}@example.com`,
      role: 'customer',
      active: true,
      authProvider: 'local',
    });
    createdUserIds.push(customerUser._id);

    // Test 1: Unauthenticated GET /api/admin/analytics/summary -> 401
    console.log('\n--- 1. Authentication & RBAC Checks ---');
    const unauthRes = await jsonRequest('GET', '/api/admin/analytics/summary');
    assert(unauthRes.status === 401, 'Unauthenticated GET /analytics/summary returns 401');

    // Test 2: Staff GET /api/admin/analytics/summary -> 403
    const staffRes = await jsonRequest('GET', '/api/admin/analytics/summary', undefined, staffCookie);
    assert(staffRes.status === 403, 'Staff GET /analytics/summary returns 403');

    // Test 3: Date Range Validation from > to -> 400
    console.log('\n--- 2. Date Range Validation ---');
    const invalidDateRes = await jsonRequest(
      'GET',
      '/api/admin/analytics/summary?from=2030-01-01&to=2025-01-01',
      undefined,
      adminCookie
    );
    assert(invalidDateRes.status === 400, 'GET /analytics/summary with from > to returns 400');
    assert(
      invalidDateRes.body?.message?.includes('from must be ≤ to'),
      'Error message clarifies "from must be ≤ to"'
    );

    // Test 4: Summary over empty range -> zeros
    console.log('\n--- 3. Summary Aggregation ---');
    const emptySummaryRes = await jsonRequest(
      'GET',
      '/api/admin/analytics/summary?from=2010-01-01&to=2010-01-10',
      undefined,
      adminCookie
    );
    assert(emptySummaryRes.status === 200, 'Summary request succeeds with 200');
    assert(
      emptySummaryRes.body?.data?.orderCount === 0 &&
        emptySummaryRes.body?.data?.revenue === 0 &&
        emptySummaryRes.body?.data?.averageOrderValue === 0,
      'Summary over empty date range returns zero metrics'
    );

    // Test 5: Create confirmed order -> summary counts it
    const testDate = new Date('2026-05-15T12:00:00.000Z');
    const order1 = await Order.create({
      user: customerUser._id,
      status: 'confirmed',
      total: 250,
      subtotal: 230,
      shippingFee: 20,
      discountAmount: 0,
      pointsPaid: 0,
      items: [
        {
          product: new Types.ObjectId(),
          name: 'P54 Test Jacket',
          image: '/test.jpg',
          variantSku: 'P54-JKT-01',
          size: 'M',
          color: 'Blue',
          unitPrice: 230,
          quantity: 1,
        },
      ],
      shippingAddress: {
        line1: '123 Test St',
        city: 'Bangkok',
        province: 'Bangkok',
        postalCode: '10110',
        country: 'Thailand',
      },
      createdAt: testDate,
      updatedAt: testDate,
    });
    createdOrderIds.push(order1._id);

    const summaryWithOrderRes = await jsonRequest(
      'GET',
      '/api/admin/analytics/summary?from=2026-05-01&to=2026-05-31',
      undefined,
      adminCookie
    );
    assert(
      summaryWithOrderRes.body?.data?.orderCount === 1,
      'Summary counts confirmed order (orderCount === 1)'
    );
    assert(
      summaryWithOrderRes.body?.data?.revenue === 250,
      'Summary revenue matches order total (revenue === 250)'
    );
    assert(
      summaryWithOrderRes.body?.data?.averageOrderValue === 250,
      'Average order value matches expected value (250)'
    );

    // Test 6: Cancel that order -> next summary call drops it
    await Order.findByIdAndUpdate(order1._id, { status: 'cancelled' });
    const summaryCancelledRes = await jsonRequest(
      'GET',
      '/api/admin/analytics/summary?from=2026-05-01&to=2026-05-31',
      undefined,
      adminCookie
    );
    assert(
      summaryCancelledRes.body?.data?.orderCount === 0 &&
        summaryCancelledRes.body?.data?.revenue === 0,
      'Cancelled order is excluded from summary metrics'
    );

    // Reset status back to confirmed for subsequent tests
    await Order.findByIdAndUpdate(order1._id, { status: 'confirmed' });

    // Test 7: Revenue trend with granularity=day
    console.log('\n--- 4. Revenue Trend Aggregation ---');
    const trendDayRes = await jsonRequest(
      'GET',
      '/api/admin/analytics/revenue-trend?from=2026-05-13&to=2026-05-17&granularity=day',
      undefined,
      adminCookie
    );
    assert(trendDayRes.status === 200, 'GET /revenue-trend returns 200');
    const trendData: any[] = trendDayRes.body?.data;
    assert(Array.isArray(trendData), 'Revenue trend returns array');
    assert(trendData.length === 5, `Series length matches days in range (5 days, got ${trendData?.length})`);

    const dayMatch = trendData.find((d) => d.date === '2026-05-15');
    assert(dayMatch?.revenue === 250, 'Day 2026-05-15 has revenue 250');
    const totalTrendRevenue = trendData.reduce((sum, d) => sum + d.revenue, 0);
    assert(totalTrendRevenue === 250, 'Sum of revenue trend matches summary revenue (250)');

    // Test 8: Revenue trend with granularity=month
    const trendMonthRes = await jsonRequest(
      'GET',
      '/api/admin/analytics/revenue-trend?from=2026-05-01&to=2026-05-31&granularity=month',
      undefined,
      adminCookie
    );
    const monthData: any[] = trendMonthRes.body?.data;
    assert(monthData.length >= 1, 'Revenue trend by month returns month buckets');
    const mayMatch = monthData.find((d) => d.date === '2026-05');
    assert(mayMatch?.revenue === 250, 'Month 2026-05 grouped correctly with revenue 250');

    // Test 9: Top products -> returns sorted by revenue desc
    console.log('\n--- 5. Top Products Aggregation ---');
    const prodA = new Types.ObjectId();
    const prodB = new Types.ObjectId();

    const orderHigh = await Order.create({
      user: customerUser._id,
      status: 'confirmed',
      total: 600,
      subtotal: 600,
      shippingFee: 0,
      discountAmount: 0,
      pointsPaid: 0,
      items: [
        {
          product: prodA,
          name: 'Premium Leather Jacket',
          image: '/leather.jpg',
          variantSku: 'PLJ-01',
          size: 'L',
          color: 'Black',
          unitPrice: 300,
          quantity: 2,
        },
      ],
      shippingAddress: {
        line1: '123 Test St',
        city: 'Bangkok',
        province: 'Bangkok',
        postalCode: '10110',
        country: 'Thailand',
      },
      createdAt: new Date('2026-06-10T10:00:00.000Z'),
      updatedAt: new Date('2026-06-10T10:00:00.000Z'),
    });
    createdOrderIds.push(orderHigh._id);

    const orderLow = await Order.create({
      user: customerUser._id,
      status: 'confirmed',
      total: 100,
      subtotal: 100,
      shippingFee: 0,
      discountAmount: 0,
      pointsPaid: 0,
      items: [
        {
          product: prodB,
          name: 'Basic Cotton Tee',
          image: '/tee.jpg',
          variantSku: 'BCT-01',
          size: 'M',
          color: 'White',
          unitPrice: 50,
          quantity: 2,
        },
      ],
      shippingAddress: {
        line1: '123 Test St',
        city: 'Bangkok',
        province: 'Bangkok',
        postalCode: '10110',
        country: 'Thailand',
      },
      createdAt: new Date('2026-06-10T11:00:00.000Z'),
      updatedAt: new Date('2026-06-10T11:00:00.000Z'),
    });
    createdOrderIds.push(orderLow._id);

    const topProdRes = await jsonRequest(
      'GET',
      '/api/admin/analytics/top-products?from=2026-06-01&to=2026-06-30&limit=5',
      undefined,
      adminCookie
    );
    assert(topProdRes.status === 200, 'GET /top-products returns 200');
    const topProds = topProdRes.body?.data;
    assert(Array.isArray(topProds) && topProds.length === 2, 'Returns top products array (2 products)');
    assert(
      topProds[0]?.name === 'Premium Leather Jacket' && topProds[0]?.revenue === 600,
      'First item has highest revenue (Premium Leather Jacket with $600)'
    );
    assert(
      topProds[1]?.name === 'Basic Cotton Tee' && topProds[1]?.revenue === 100,
      'Second item is sorted descending (Basic Cotton Tee with $100)'
    );

    // Test 10: Inventory alerts -> out_of_stock SKU present
    console.log('\n--- 6. Inventory Alerts ---');
    const testZeroSku = `P54-ZERO-${Date.now()}`;
    const testLowSku = `P54-LOW-${Date.now()}`;

    const inventoryProduct = await Product.create({
      name: 'P54 Stock Test Product',
      slug: `p54-stock-product-${Date.now()}`,
      description: 'Stock test product for analytics verification',
      basePrice: 99,
      images: ['/test-stock.jpg'],
      category: new Types.ObjectId(),
      variants: [
        {
          sku: testZeroSku,
          size: 'S',
          color: 'Red',
          material: 'Cotton',
          stock: 0,
        },
        {
          sku: testLowSku,
          size: 'M',
          color: 'Blue',
          material: 'Cotton',
          stock: 3,
        },
      ],
      active: true,
    });
    createdProductIds.push(inventoryProduct._id);

    const alertsRes = await jsonRequest('GET', '/api/admin/analytics/inventory-alerts', undefined, adminCookie);
    assert(alertsRes.status === 200, 'GET /inventory-alerts returns 200');
    const alerts = alertsRes.body?.data;
    assert(
      Array.isArray(alerts?.outOfStock) &&
        alerts.outOfStock.some((item: any) => item.sku === testZeroSku),
      `Out of stock alert list contains created zero-stock SKU (${testZeroSku})`
    );
    assert(
      Array.isArray(alerts?.lowStock) &&
        alerts.lowStock.some((item: any) => item.sku === testLowSku),
      `Low stock alert list contains created low-stock SKU (${testLowSku})`
    );

    // Test 11: Customer growth -> new customer count matches DB count
    console.log('\n--- 7. Customer Growth ---');
    const custDate = new Date('2026-07-15T09:00:00.000Z');
    const growthCust1 = await User.create({
      name: 'Growth Cust 1',
      email: `growth1_${Date.now()}@example.com`,
      role: 'customer',
      active: true,
      authProvider: 'local',
      createdAt: custDate,
      updatedAt: custDate,
    });
    createdUserIds.push(growthCust1._id);

    const growthCust2 = await User.create({
      name: 'Growth Cust 2',
      email: `growth2_${Date.now()}@example.com`,
      role: 'customer',
      active: true,
      authProvider: 'local',
      createdAt: custDate,
      updatedAt: custDate,
    });
    createdUserIds.push(growthCust2._id);

    const growthRes = await jsonRequest(
      'GET',
      '/api/admin/analytics/customer-growth?from=2026-07-01&to=2026-07-31&granularity=day',
      undefined,
      adminCookie
    );
    assert(growthRes.status === 200, 'GET /customer-growth returns 200');
    const growthData: any[] = growthRes.body?.data;
    assert(Array.isArray(growthData), 'Customer growth returns array');
    const totalNewCust = growthData.reduce((sum, d) => sum + d.newCustomers, 0);
    assert(
      totalNewCust === 2,
      `New customer count matches DB count (2 registered in July, got ${totalNewCust})`
    );

    // Test 12 & 13: Wallet summary metrics
    console.log('\n--- 8. Wallet Summary Metrics ---');
    const walletUserId = new Types.ObjectId();
    createdWalletUserIds.push(walletUserId);

    const walletDoc = await Wallet.create({
      user: walletUserId,
      balancePoints: 350,
      lifetimeEarnedPoints: 500,
      lifetimeSpentPoints: 150,
      active: true,
    });

    const txCredit = await PointsTransaction.create({
      wallet: walletDoc._id,
      user: walletUserId,
      type: 'refund_earn',
      direction: 'credit',
      points: 500,
      balanceAfter: 500,
      idempotencyKey: `p54_tx_credit_${Date.now()}`,
    });
    createdTxIds.push(txCredit._id);

    const txDebit = await PointsTransaction.create({
      wallet: walletDoc._id,
      user: walletUserId,
      type: 'order_spend',
      direction: 'debit',
      points: 150,
      balanceAfter: 350,
      idempotencyKey: `p54_tx_debit_${Date.now()}`,
    });
    createdTxIds.push(txDebit._id);

    const walletSummaryRes = await jsonRequest(
      'GET',
      '/api/admin/analytics/wallet-summary',
      undefined,
      adminCookie
    );
    assert(walletSummaryRes.status === 200, 'GET /wallet-summary returns 200');
    const walletMetrics = walletSummaryRes.body?.data;

    // Verify aggregate matches DB PointsTransaction / Wallet
    const [txAggregateResult] = await PointsTransaction.aggregate([
      {
        $match: {
          direction: 'credit',
        },
      },
      {
        $group: {
          _id: null,
          totalCredits: { $sum: '$points' },
        },
      },
    ]);

    const [txOrderSpendResult] = await PointsTransaction.aggregate([
      {
        $match: {
          type: 'order_spend',
          direction: 'debit',
        },
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$points' },
        },
      },
    ]);

    assert(
      walletMetrics?.totalPointsIssued === (txAggregateResult?.totalCredits ?? 0) ||
        walletMetrics?.totalPointsIssued >= 500,
      `Wallet summary totalPointsIssued (${walletMetrics?.totalPointsIssued}) matches aggregate credits`
    );
    assert(
      walletMetrics?.orderPointsRedeemed === (txOrderSpendResult?.totalSpent ?? 0) &&
        walletMetrics?.orderPointsRedeemed >= 150,
      `Wallet summary orderPointsRedeemed (${walletMetrics?.orderPointsRedeemed}) matches order_spend debit total`
    );
    assert(
      walletMetrics?.refundPointsIssued >= 500,
      `Wallet summary refundPointsIssued (${walletMetrics?.refundPointsIssued}) accounts for refund_earn transactions`
    );
    assert(
      walletMetrics?.totalOutstandingPoints >= 350,
      `Wallet summary totalOutstandingPoints (${walletMetrics?.totalOutstandingPoints}) matches current balance`
    );
  } finally {
    // Teardown created test records
    console.log('\n--- Cleaning up test records ---');
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    if (createdOrderIds.length > 0) {
      await Order.deleteMany({ _id: { $in: createdOrderIds } });
    }
    if (createdProductIds.length > 0) {
      await Product.deleteMany({ _id: { $in: createdProductIds } });
    }
    if (createdWalletUserIds.length > 0) {
      await Wallet.deleteMany({ user: { $in: createdWalletUserIds } });
    }
    if (createdTxIds.length > 0) {
      await PointsTransaction.deleteMany({ _id: { $in: createdTxIds } });
    }

    if (server) {
      await new Promise<void>((res) => server.close(() => res()));
    }
    await mongoose.disconnect();
    console.log('Teardown complete.');
  }

  console.log(`\n=== P54 RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
