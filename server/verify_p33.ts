import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

function request(method: string, path: string, body?: any, cookie?: string): Promise<{ status: number; body: any; setCookie?: string[] }> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cookie) headers['Cookie'] = cookie;
    if (data) headers['Content-Length'] = Buffer.byteLength(data).toString();
    const req = http.request({ hostname: 'localhost', port: 5000, path, method, headers }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        let parsed: any;
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        resolve({ status: res.statusCode || 500, body: parsed, setCookie });
      });
    });
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
  console.log('       RUNNING P33 INVENTORY API VERIFICATION       ');
  console.log('====================================================\n');

  // 1. Unauthenticated request
  console.log('TEST 1: Unauthenticated request to /api/admin/inventory (expect 401)...');
  const r1 = await request('GET', '/api/admin/inventory');
  if (r1.status !== 401) {
    throw new Error(`Expected status 401, got ${r1.status}: ${JSON.stringify(r1.body)}`);
  }
  console.log('✔ Correctly rejected unauthenticated request with 401.\n');

  // 2. Setup user and test customer 403
  console.log('TEST 2: Register user and verify customer role 403 rejection...');
  const email = `p33_test_${Date.now()}@example.com`;
  const pass = 'password123';
  await request('POST', '/api/auth/register', { name: 'P33 Tester', email, password: pass });
  const custLogin = await request('POST', '/api/auth/login', { email, password: pass });
  const custCookie = getCookieHeader(custLogin);

  const r2 = await request('GET', '/api/admin/inventory', null, custCookie);
  if (r2.status !== 403) {
    throw new Error(`Expected status 403 for customer, got ${r2.status}: ${JSON.stringify(r2.body)}`);
  }
  console.log('✔ Correctly rejected customer role with 403.\n');

  // 3. Promote to admin and test successful fetch
  console.log('TEST 3: Promote user to admin and test GET /api/admin/inventory...');
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/shop';
  await mongoose.connect(mongoUri);
  await mongoose.connection.collection('users').updateOne({ email }, { $set: { role: 'admin' } });
  await mongoose.disconnect();

  const adminLogin = await request('POST', '/api/auth/login', { email, password: pass });
  const adminCookie = getCookieHeader(adminLogin);

  const r3 = await request('GET', '/api/admin/inventory?limit=5', null, adminCookie);
  if (r3.status !== 200 || !r3.body.success || !Array.isArray(r3.body.data?.items)) {
    throw new Error(`GET /api/admin/inventory failed: ${JSON.stringify(r3.body)}`);
  }
  console.log(`✔ Retrieved ${r3.body.data.items.length} items (total: ${r3.body.data.total}, pages: ${r3.body.data.pages}).`);
  const firstItem = r3.body.data.items[0];
  console.log(`  Sample row: SKU=${firstItem.sku}, Product="${firstItem.product.name}", Stock=${firstItem.stock}, Status=${firstItem.status}\n`);

  // 4. Test low_stock filter
  console.log('TEST 4: Test ?status=low_stock filter (strictly 1 <= stock <= 5)...');
  const r4 = await request('GET', '/api/admin/inventory?status=low_stock&limit=20', null, adminCookie);
  if (r4.status !== 200) throw new Error(`low_stock query failed: ${JSON.stringify(r4.body)}`);
  for (const item of r4.body.data?.items || []) {
    if (item.stock <= 0 || item.stock > 5) {
      throw new Error(`Item ${item.sku} stock=${item.stock} violates low_stock (1..5) constraint!`);
    }
    if (item.status !== 'low_stock') {
      throw new Error(`Item ${item.sku} status=${item.status} expected low_stock!`);
    }
  }
  console.log(`✔ Verified ${r4.body.data.items.length} low_stock items all have 1 <= stock <= 5.\n`);

  // 5. Test out_of_stock filter
  console.log('TEST 5: Test ?status=out_of_stock filter (strictly stock === 0)...');
  const r5 = await request('GET', '/api/admin/inventory?status=out_of_stock&limit=20', null, adminCookie);
  if (r5.status !== 200) throw new Error(`out_of_stock query failed: ${JSON.stringify(r5.body)}`);
  for (const item of r5.body.data?.items || []) {
    if (item.stock !== 0) {
      throw new Error(`Item ${item.sku} stock=${item.stock} violates out_of_stock (0) constraint!`);
    }
    if (item.status !== 'out_of_stock') {
      throw new Error(`Item ${item.sku} status=${item.status} expected out_of_stock!`);
    }
  }
  console.log(`✔ Verified ${r5.body.data.items.length} out_of_stock items all have stock === 0.\n`);

  // 6. Test search filter
  console.log('TEST 6: Test ?search filter on product name / sku...');
  const r6 = await request('GET', `/api/admin/inventory?search=${encodeURIComponent(firstItem.sku)}`, null, adminCookie);
  if (r6.status !== 200 || !r6.body.data?.items?.some((i: any) => i.sku === firstItem.sku)) {
    throw new Error(`Search by SKU '${firstItem.sku}' did not return target item`);
  }
  console.log(`✔ Search by SKU '${firstItem.sku}' returned matching rows.\n`);

  // 7. Test PATCH /api/admin/inventory/:sku/adjust
  console.log(`TEST 7: Test stock adjustment on SKU ${firstItem.sku}...`);
  const targetNewStock = firstItem.stock + 5;
  const r7 = await request('PATCH', `/api/admin/inventory/${firstItem.sku}/adjust`, { stock: targetNewStock }, adminCookie);
  if (r7.status !== 200 || r7.body.data?.stock !== targetNewStock) {
    throw new Error(`Failed adjusting stock: ${JSON.stringify(r7.body)}`);
  }
  console.log(`✔ Adjusted SKU ${firstItem.sku} from ${firstItem.stock} to ${targetNewStock}. Status: ${r7.body.data.status}`);

  // Revert back
  const r7Revert = await request('PATCH', `/api/admin/inventory/${firstItem.sku}/adjust`, { stock: firstItem.stock }, adminCookie);
  if (r7Revert.status !== 200 || r7Revert.body.data?.stock !== firstItem.stock) {
    throw new Error(`Failed reverting stock: ${JSON.stringify(r7Revert.body)}`);
  }
  console.log(`✔ Successfully restored SKU ${firstItem.sku} back to original ${firstItem.stock}.\n`);

  console.log('====================================================');
  console.log('      ALL P33 BACKEND VERIFICATIONS PASSED!         ');
  console.log('====================================================');
}

run().catch((err) => {
  console.error('P33 Verification FAILED:', err);
  process.exit(1);
});
