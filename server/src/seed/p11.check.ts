import dotenv from 'dotenv';
import mongoose from 'mongoose';
import http from 'http';
import app from '../app';
import { Product } from '../models/Product';
import { Category } from '../models/Category';

dotenv.config();

async function runAutomatedTests() {
  console.log('====================================================');
  console.log('       RUNNING AUTOMATED PRODUCT API TESTS          ');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/shop';
  if (mongoose.connection.readyState === 0) {
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('MongoDB connection established.\n');
  }

  let server: http.Server | null = null;
  let baseUrl = 'http://localhost:5000/api';

  // Check if main server is running on 5000, otherwise boot temporary instance
  try {
    const healthCheck = await fetch('http://localhost:5000/api/health', { signal: AbortSignal.timeout(1000) });
    if (!healthCheck.ok) throw new Error('Server not ready');
    console.log('✔ Connected to running server on http://localhost:5000\n');
  } catch {
    console.log('Starting ephemeral test server instance...');
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server!.listen(0, () => resolve());
    });
    const port = (server.address() as any).port;
    baseUrl = `http://localhost:${port}/api`;
    console.log(`✔ Ephemeral test server listening on ${baseUrl}\n`);
  }

  try {
    // ── Test 1: GET /api/products?page=1&limit=8 ─────────────────────────────
    console.log('TEST 1: Paginated products list (?page=1&limit=8)');
    const res1 = await fetch(`${baseUrl}/products?page=1&limit=8`);
    if (res1.status !== 200) throw new Error(`Expected status 200, got ${res1.status}`);
    const json1: any = await res1.json();
    const data1 = json1.data;

    console.log(`  Items returned: ${data1.items.length} (Expected: 8)`);
    console.log(`  Pagination info: results=${data1.results}, total=${data1.total}, page=${data1.page}, pages=${data1.pages}`);

    if (data1.items.length !== 8) throw new Error(`Expected 8 items on page 1, got ${data1.items.length}`);
    if (data1.total !== 36) throw new Error(`Expected total 36, got ${data1.total}`);
    if (data1.pages !== 5) throw new Error(`Expected 5 total pages (ceil(36/8)), got ${data1.pages}`);
    console.log('  ✔ PASS: Pagination math and page 1 items are valid.\n');

    // ── Test 2: Last Partial Page (page=5 with limit=8) ──────────────────────
    console.log('TEST 2: Last partial page boundary math (?page=5&limit=8)');
    const resLast = await fetch(`${baseUrl}/products?page=5&limit=8`);
    const jsonLast: any = await resLast.json();
    const dataLast = jsonLast.data;

    console.log(`  Items returned: ${dataLast.items.length} (Expected: 4)`);
    if (dataLast.items.length !== 4) throw new Error(`Expected 4 items on page 5, got ${dataLast.items.length}`);
    console.log('  ✔ PASS: Partial page boundary handled correctly.\n');

    // ── Test 3: Product Detail by Slug with Populated Category ───────────────
    console.log('TEST 3: Product detail by slug with populated category');
    const testSlug = data1.items[0].slug;
    const resDetail = await fetch(`${baseUrl}/products/${testSlug}`);
    if (resDetail.status !== 200) throw new Error(`Expected status 200, got ${resDetail.status}`);
    const jsonDetail: any = await resDetail.json();
    const product = jsonDetail.data;

    console.log(`  Slug: ${product.slug}`);
    console.log(`  Product Name: ${product.name}`);
    console.log(`  Populated Category: ${JSON.stringify(product.category.name)}`);

    if (!product.category || typeof product.category !== 'object' || !product.category.name) {
      throw new Error('Category was not populated as an object with name');
    }
    console.log('  ✔ PASS: Product detail retrieved with populated category.\n');

    // ── Test 4: 404 for Bogus Slug ───────────────────────────────────────────
    console.log('TEST 4: Non-existent product slug error response');
    const res404 = await fetch(`${baseUrl}/products/bogus-nonexistent-slug-xyz`);
    console.log(`  Status: ${res404.status} (Expected: 404)`);
    const json404: any = await res404.json();
    console.log(`  Message: ${json404.message}`);

    if (res404.status !== 404) throw new Error(`Expected 404 status, got ${res404.status}`);
    if (!json404.message) throw new Error('Expected error message in response');
    console.log('  ✔ PASS: 404 handled gracefully with proper message.\n');

    // ── Test 5: Category Filter Query ────────────────────────────────────────
    console.log('TEST 5: Filtering products by category slug (?category=mens)');
    const resCategory = await fetch(`${baseUrl}/products?category=mens`);
    const jsonCategory: any = await resCategory.json();
    const categoryData = jsonCategory.data;

    console.log(`  Mens category count: ${categoryData.total} (Expected: 4)`);
    if (categoryData.total !== 4) throw new Error(`Expected 4 products in mens category, got ${categoryData.total}`);
    console.log('  ✔ PASS: Category filtering works accurately.\n');

    // ── Test 6: Exclusion of Draft & Archived Products ───────────────────────
    console.log('TEST 6: Draft & Archived products exclusion');
    const sampleCategory = await Category.findOne();
    const draftProduct = await Product.create({
      name: 'Temporary Draft Test Product',
      slug: 'temp-draft-test-product',
      description: 'Draft product should never be listed',
      category: sampleCategory!._id,
      images: ['https://via.placeholder.com/800'],
      basePrice: 99,
      status: 'draft',
      variants: [{ size: 'M', color: 'Black', material: 'Cotton', sku: 'TMP-DRF-M', stock: 5 }],
    });

    const resListAfterDraft = await fetch(`${baseUrl}/products?limit=100`);
    const jsonListAfterDraft: any = await resListAfterDraft.json();
    const draftFound = jsonListAfterDraft.data.items.some((p: any) => p.slug === 'temp-draft-test-product');

    // Cleanup test draft product
    await Product.deleteOne({ _id: draftProduct._id });

    if (draftFound) throw new Error('Draft product was returned in public active list endpoint');
    console.log('  ✔ PASS: Draft/archived products are excluded from public catalog.\n');

    console.log('====================================================');
    console.log('        🎉 ALL AUTOMATED TESTS PASSED!              ');
    console.log('====================================================');
  } finally {
    if (server) {
      server.close();
    }
  }
}

if (require.main === module) {
  runAutomatedTests()
    .then(async () => {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('\n❌ Automated Test Suite FAILED:', err);
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      process.exit(1);
    });
}
