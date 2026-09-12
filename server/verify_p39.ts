import http from 'http';
import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
import { Product } from './src/models/Product';
import { Category } from './src/models/Category';

dotenv.config();

const API_PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/shop';

function request(
  method: string,
  path: string,
  body?: any,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        hostname: 'localhost',
        port: API_PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 500, body: data ? JSON.parse(data) : null });
          } catch (e) {
            resolve({ status: res.statusCode || 500, body: data });
          }
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
  console.log('   RUNNING P39 CHECKOUT & INVENTORY VALIDATION TEST  ');
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
  console.log('✔ Connected directly to MongoDB for fixtures.\n');

  try {
    // 0. Setup dummy category and product with 2 variants
    let category = await Category.findOne();
    if (!category) {
      category = await Category.create({
        name: 'Test Clothing',
        slug: `test-clothing-${Date.now()}`,
        status: 'active',
      });
    }

    const testSkuInStock = `P39-IN-${Date.now()}`;
    const testSkuOutStock = `P39-OUT-${Date.now()}`;
    const testSkuPartial = `P39-PART-${Date.now()}`;

    const testProduct = await Product.create({
      name: 'P39 Checkout Test Shirt',
      slug: `p39-checkout-shirt-${Date.now()}`,
      description: 'Testing checkout bag live inventory validation',
      category: category._id,
      images: ['https://example.com/shirt.jpg'],
      basePrice: 500,
      status: 'active',
      variants: [
        {
          sku: testSkuInStock,
          size: 'M',
          color: 'Navy',
          material: 'Cotton',
          stock: 20,
        },
        {
          sku: testSkuOutStock,
          size: 'L',
          color: 'Navy',
          material: 'Cotton',
          stock: 0,
        },
        {
          sku: testSkuPartial,
          size: 'S',
          color: 'Navy',
          material: 'Cotton',
          stock: 3,
        },
      ],
    });

    console.log(`Created test product with 3 variants (${testSkuInStock}: 20, ${testSkuOutStock}: 0, ${testSkuPartial}: 3)`);

    // ── TEST 1: POST /api/inventory/validate - in-stock line item ──
    console.log('\n--- TEST 1: In-Stock Line Item ---');
    const res1 = await request('POST', '/api/inventory/validate', [
      { sku: testSkuInStock, qty: 5 },
    ]);
    assert(res1.status === 200, 'POST /api/inventory/validate returns 200');
    assert(res1.body.success === true, 'Response success is true');
    assert(Array.isArray(res1.body.data), 'Response data is array');
    const item1 = res1.body.data.find((d: any) => d.sku === testSkuInStock);
    assert(item1 && item1.ok === true, 'Item has ok: true');
    assert(item1 && item1.available === 20, 'Item available is 20');
    assert(item1 && item1.shortfall === 0, 'Item shortfall is 0');

    // ── TEST 2: POST /api/inventory/validate - out-of-stock line item (stock = 0) ──
    console.log('\n--- TEST 2: Out-Of-Stock Line Item (stock = 0) ---');
    const res2 = await request('POST', '/api/inventory/validate', [
      { sku: testSkuOutStock, qty: 1 },
    ]);
    assert(res2.status === 200, 'Returns 200 status');
    const item2 = res2.body.data.find((d: any) => d.sku === testSkuOutStock);
    assert(item2 && item2.ok === false, 'Out-of-stock item has ok: false');
    assert(item2 && item2.available === 0, 'Out-of-stock item has available: 0');
    assert(item2 && item2.shortfall === 1, 'Out-of-stock item has shortfall: 1');

    // ── TEST 3: POST /api/inventory/validate - partial-stock line item ──
    console.log('\n--- TEST 3: Partial-Stock Line Item (stock < requested) ---');
    const res3 = await request('POST', '/api/inventory/validate', [
      { sku: testSkuPartial, qty: 5 },
    ]);
    assert(res3.status === 200, 'Returns 200 status');
    const item3 = res3.body.data.find((d: any) => d.sku === testSkuPartial);
    assert(item3 && item3.ok === false, 'Partial item has ok: false');
    assert(item3 && item3.available === 3, 'Partial item has available: 3');
    assert(item3 && item3.shortfall === 2, 'Partial item has shortfall: 2');

    // ── TEST 4: POST /api/inventory/validate - mixed bag request ──
    console.log('\n--- TEST 4: Mixed Bag Validation ---');
    const res4 = await request('POST', '/api/inventory/validate', [
      { sku: testSkuInStock, qty: 2 },
      { sku: testSkuOutStock, qty: 1 },
      { sku: testSkuPartial, qty: 1 },
    ]);
    assert(res4.status === 200, 'Returns 200 status');
    assert(res4.body.data.length === 3, 'Returns validation for all 3 items');
    const mIn = res4.body.data.find((d: any) => d.sku === testSkuInStock);
    const mOut = res4.body.data.find((d: any) => d.sku === testSkuOutStock);
    const mPart = res4.body.data.find((d: any) => d.sku === testSkuPartial);
    assert(mIn?.ok === true, 'In-stock item passes');
    assert(mOut?.ok === false, 'Out-of-stock item fails');
    assert(mPart?.ok === true, 'Partial item with qty <= available passes');

    // ── TEST 5: Dynamic stock drop simulation ──
    console.log('\n--- TEST 5: Dynamic Stock Drop Simulation ---');
    // Drop testSkuInStock to 0 directly in MongoDB (per acceptance test: "Drop a cart item's stock to 0 in MongoDB")
    await Product.updateOne(
      { _id: testProduct._id, 'variants.sku': testSkuInStock },
      { $set: { 'variants.$.stock': 0 } }
    );
    const res5 = await request('POST', '/api/inventory/validate', [
      { sku: testSkuInStock, qty: 2 },
    ]);
    const item5 = res5.body.data.find((d: any) => d.sku === testSkuInStock);
    assert(item5 && item5.ok === false, 'After dropping stock to 0 in MongoDB, validation fails with ok: false');
    assert(item5 && item5.available === 0, 'Available is now 0');
    assert(item5 && item5.shortfall === 2, 'Shortfall is 2');

    // ── TEST 6: Invalid request validation ──
    console.log('\n--- TEST 6: Schema Validation Edge Cases ---');
    const res6 = await request('POST', '/api/inventory/validate', [
      { sku: '', qty: 1 },
    ]);
    assert(res6.status === 400, 'Empty SKU rejected with 400');

    // Cleanup test product
    await Product.deleteOne({ _id: testProduct._id });
    console.log('\n✔ Test product cleaned up from database.');

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
