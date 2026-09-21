import http from 'http';
import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import app from './src/app';
import { User } from './src/models/User';
import { Supplier } from './src/models/Supplier';
import { Product } from './src/models/Product';
import { Category } from './src/models/Category';
import { Department } from './src/models/Department';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_1234567890_super_secret';
const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shop';

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

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName}${detail ? ` — ${detail}` : ''}`);
  }
}

async function runTests() {
  console.log('Connecting to MongoDB at', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as any;
      serverPort = addr.port;
      console.log(`Test server running on port ${serverPort}`);
      resolve();
    });
  });

  const createdUserIds: Types.ObjectId[] = [];
  const createdSupplierIds: Types.ObjectId[] = [];
  const createdProductIds: Types.ObjectId[] = [];
  let testDeptId: Types.ObjectId | null = null;
  let testCatId: Types.ObjectId | null = null;

  try {
    console.log('\n=== P60 VERIFICATION: SUPPLIER-PRODUCT ASSOCIATION ===\n');

    // ── Phase 1: Model & Schema Verification ─────────────────────────────────
    console.log('--- Phase 1: Model & Schema Verification ---');
    const variantSchemaPath = (Product.schema as any).path('variants.supplier');
    assert(!!variantSchemaPath, 'Product variant schema contains supplier path');
    assert(variantSchemaPath.options.ref === 'Supplier', 'Product variant supplier references Supplier model');
    assert(variantSchemaPath.options.default === null, 'Product variant supplier defaults to null');

    const indexes = Product.schema.indexes();
    const hasSupplierIndex = indexes.some(
      ([fields]: any) => fields && fields['variants.supplier'] === 1
    );
    assert(hasSupplierIndex, 'Product schema has index on variants.supplier');

    // ── Phase 2: Setup Test Users & Category ──────────────────────────────────
    console.log('\n--- Phase 2: Test Fixtures Setup ---');
    const adminUser = await User.create({
      name: 'P60 Admin',
      email: `p60_admin_${Date.now()}@larvo.com`,
      passwordHash: '$2a$10$dummyhashfortestingonly1234567890',
      role: 'admin',
    });
    createdUserIds.push(adminUser._id);
    const adminCookie = makeAuthCookie(adminUser._id.toString());

    const staffUser = await User.create({
      name: 'P60 Staff',
      email: `p60_staff_${Date.now()}@larvo.com`,
      passwordHash: '$2a$10$dummyhashfortestingonly1234567890',
      role: 'staff',
    });
    createdUserIds.push(staffUser._id);
    const staffCookie = makeAuthCookie(staffUser._id.toString());

    const customerUser = await User.create({
      name: 'P60 Customer',
      email: `p60_customer_${Date.now()}@larvo.com`,
      passwordHash: '$2a$10$dummyhashfortestingonly1234567890',
      role: 'customer',
    });
    createdUserIds.push(customerUser._id);
    const customerCookie = makeAuthCookie(customerUser._id.toString());

    // Create Category + Department for test products
    const testDept = await Department.create({
      name: `P60 Dept ${Date.now()}`,
      slug: `p60-dept-${Date.now()}`,
      image: 'https://example.com/dept.jpg',
      active: true,
    });
    testDeptId = testDept._id;

    const testCat = await Category.create({
      name: `P60 Category ${Date.now()}`,
      slug: `p60-cat-${Date.now()}`,
      department: testDeptId,
      image: 'https://example.com/cat.jpg',
      active: true,
    });
    testCatId = testCat._id;
    assert(!!testCatId, 'Created test Category and Department');

    // ── Phase 3: Create Suppliers ─────────────────────────────────────────────
    console.log('\n--- Phase 3: Create Test Suppliers ---');
    const supARes = await jsonRequest(
      'POST',
      '/api/admin/suppliers',
      {
        name: 'Alice Jenkins',
        companyName: `Apex Textiles P60 ${Date.now()}`,
        email: `apex_${Date.now()}@supplier.com`,
        phone: '+1 555 111 2222',
        address: '100 Industrial Pkwy, Greenville, SC',
        notes: 'High-grade organic cotton supplier',
      },
      adminCookie
    );
    assert(supARes.status === 201 && supARes.body.success, 'POST /api/admin/suppliers creates Supplier A');
    const supplierA = supARes.body.data.supplier;
    createdSupplierIds.push(new Types.ObjectId(supplierA._id));

    const supBRes = await jsonRequest(
      'POST',
      '/api/admin/suppliers',
      {
        name: 'Bob Vance',
        companyName: `Vance Fabrics P60 ${Date.now()}`,
        email: `vance_${Date.now()}@supplier.com`,
        phone: '+1 555 333 4444',
        address: '200 River Rd, Scranton, PA',
        notes: 'Unlinked test supplier for deletion test',
      },
      adminCookie
    );
    assert(supBRes.status === 201 && supBRes.body.success, 'POST /api/admin/suppliers creates Supplier B');
    const supplierB = supBRes.body.data.supplier;
    createdSupplierIds.push(new Types.ObjectId(supplierB._id));

    // ── Phase 4: Create Product with Variant Suppliers ────────────────────────
    console.log('\n--- Phase 4: Product Creation with Variant Supplier Linking ---');
    const sku1 = `P60-SKU-A1-${Date.now()}`;
    const sku2 = `P60-SKU-A2-${Date.now()}`;
    const sku3 = `P60-SKU-NONE-${Date.now()}`;

    const prodRes = await jsonRequest(
      'POST',
      '/api/admin/products',
      {
        name: `P60 Organic Cotton Tee ${Date.now()}`,
        description: 'Premium organic cotton t-shirt with supplier links',
        category: testCatId.toString(),
        images: ['https://example.com/tee.jpg'],
        basePrice: 1200,
        status: 'active',
        variants: [
          {
            size: 'M',
            color: 'White',
            material: '100% Organic Cotton',
            sku: sku1,
            stock: 25,
            supplier: supplierA._id,
          },
          {
            size: 'L',
            color: 'White',
            material: '100% Organic Cotton',
            sku: sku2,
            stock: 15,
            supplier: supplierA._id,
          },
          {
            size: 'S',
            color: 'Heather Grey',
            material: 'Cotton Blend',
            sku: sku3,
            stock: 8,
            supplier: null, // Unassigned
          },
        ],
      },
      adminCookie
    );
    assert(prodRes.status === 201 && prodRes.body.success, 'POST /api/admin/products creates product with variant suppliers');
    const product = prodRes.body.data.product || prodRes.body.data;
    createdProductIds.push(new Types.ObjectId(product._id));

    // Verify variants stored in DB
    const dbProduct = await Product.findById(product._id);
    assert(!!dbProduct, 'Product found in database');
    const v1 = dbProduct?.variants.find((v) => v.sku === sku1);
    const v2 = dbProduct?.variants.find((v) => v.sku === sku2);
    const v3 = dbProduct?.variants.find((v) => v.sku === sku3);
    assert(v1?.supplier?.toString() === supplierA._id, 'Variant 1 supplier matches Supplier A ObjectId in DB');
    assert(v2?.supplier?.toString() === supplierA._id, 'Variant 2 supplier matches Supplier A ObjectId in DB');
    assert(v3?.supplier === null || v3?.supplier === undefined, 'Variant 3 supplier is null/unassigned in DB');

    // Verify GET /api/admin/products populates supplier
    const adminProductsRes = await jsonRequest('GET', `/api/admin/products?q=${sku1}`, undefined, adminCookie);
    assert(adminProductsRes.status === 200, 'GET /api/admin/products succeeds');
    const foundItem = adminProductsRes.body.data.items?.find((p: any) => p._id === product._id);
    assert(!!foundItem, 'Product found in GET /api/admin/products');
    const populatedV1 = foundItem?.variants?.find((v: any) => v.sku === sku1);
    assert(
      populatedV1?.supplier?.companyName === supplierA.companyName,
      'variants.supplier is populated with companyName in admin products listing'
    );

    // ── Phase 5: GET /api/admin/suppliers/:id/products ────────────────────────
    console.log('\n--- Phase 5: GET /api/admin/suppliers/:id/products ---');
    // Supplier A (has 2 variants linked)
    const supAProductsRes = await jsonRequest(
      'GET',
      `/api/admin/suppliers/${supplierA._id}/products`,
      undefined,
      adminCookie
    );
    assert(supAProductsRes.status === 200 && supAProductsRes.body.success, 'GET /api/admin/suppliers/:id/products returns 200 for Supplier A');
    assert(supAProductsRes.body.data.totalProducts === 1, 'totalProducts is 1 for Supplier A');
    assert(supAProductsRes.body.data.totalVariants === 2, 'totalVariants is 2 for Supplier A');
    const supAProd = supAProductsRes.body.data.products[0];
    assert(supAProd._id === product._id, 'Returned product matches created test product');
    assert(supAProd.variants.length === 2, 'Filtered to only variants supplied by Supplier A (excludes sku3)');
    const supASkus = supAProd.variants.map((v: any) => v.sku);
    assert(supASkus.includes(sku1) && supASkus.includes(sku2), 'Returned variants include sku1 and sku2');
    assert(!supASkus.includes(sku3), 'Returned variants do not include unassigned sku3');

    // Supplier B (has 0 variants linked)
    const supBProductsRes = await jsonRequest(
      'GET',
      `/api/admin/suppliers/${supplierB._id}/products`,
      undefined,
      adminCookie
    );
    assert(supBProductsRes.status === 200 && supBProductsRes.body.success, 'GET /api/admin/suppliers/:id/products returns 200 for Supplier B');
    assert(supBProductsRes.body.data.totalProducts === 0, 'totalProducts is 0 for Supplier B');
    assert(supBProductsRes.body.data.totalVariants === 0, 'totalVariants is 0 for Supplier B');
    assert(supBProductsRes.body.data.products.length === 0, 'products array is empty for Supplier B');

    // Invalid ID format
    const invalidIdRes = await jsonRequest('GET', '/api/admin/suppliers/notanobjectid/products', undefined, adminCookie);
    assert(invalidIdRes.status === 400, 'Invalid supplier ID returns 400 Bad Request');

    // Non-existent supplier ID
    const nonExistentId = new Types.ObjectId().toString();
    const notFoundRes = await jsonRequest('GET', `/api/admin/suppliers/${nonExistentId}/products`, undefined, adminCookie);
    assert(notFoundRes.status === 404, 'Non-existent supplier ID returns 404 Not Found');

    // ── Phase 6: Inventory Dashboard Integration ──────────────────────────────
    console.log('\n--- Phase 6: Admin Inventory Supplier Filtering ---');
    // Filter by Supplier A
    const invSupARes = await jsonRequest(
      'GET',
      `/api/admin/inventory?supplier=${supplierA._id}`,
      undefined,
      adminCookie
    );
    assert(invSupARes.status === 200 && invSupARes.body.success, 'GET /api/admin/inventory?supplier=<id> returns 200');
    const invAItems = invSupARes.body.data.items;
    const allMatchSupA = invAItems.length > 0 && invAItems.every((item: any) => item.supplier?._id === supplierA._id);
    assert(allMatchSupA, 'Every item in inventory filtered by Supplier A matches Supplier A ID');
    const invASkus = invAItems.map((i: any) => i.sku);
    assert(invASkus.includes(sku1) && invASkus.includes(sku2), 'Inventory result contains sku1 and sku2');
    assert(!invASkus.includes(sku3), 'Inventory result excludes sku3');

    // Filter by unassigned
    const invUnassignedRes = await jsonRequest(
      'GET',
      `/api/admin/inventory?supplier=unassigned&search=${sku3}`,
      undefined,
      adminCookie
    );
    assert(invUnassignedRes.status === 200 && invUnassignedRes.body.success, 'GET /api/admin/inventory?supplier=unassigned returns 200');
    const unassignedItems = invUnassignedRes.body.data.items;
    const foundSku3InUnassigned = unassignedItems.some((i: any) => i.sku === sku3 && !i.supplier);
    assert(foundSku3InUnassigned, 'Unassigned filter contains sku3 with supplier === null');

    // ── Phase 7: Referential Integrity & Deletion Rules ───────────────────────
    console.log('\n--- Phase 7: Referential Integrity & Deletion Rules ---');
    // 1. Deactivating a supplier preserves existing product variant references
    const deactRes = await jsonRequest(
      'PATCH',
      `/api/admin/suppliers/${supplierA._id}/deactivate`,
      {},
      adminCookie
    );
    assert(deactRes.status === 200 && deactRes.body.success, 'PATCH /api/admin/suppliers/:id/deactivate succeeds');
    assert(deactRes.body.data.supplier.status === 'inactive', 'Supplier A status is now inactive');

    const checkProductAfterDeact = await Product.findById(product._id);
    const v1AfterDeact = checkProductAfterDeact?.variants.find((v) => v.sku === sku1);
    assert(
      v1AfterDeact?.supplier?.toString() === supplierA._id,
      'Product variant reference to Supplier A remains intact after supplier deactivation (preserves history)'
    );

    // 2. Attempting to delete a supplier linked to variants must return 409 Conflict
    const delLinkedRes = await jsonRequest(
      'DELETE',
      `/api/admin/suppliers/${supplierA._id}`,
      undefined,
      adminCookie
    );
    assert(delLinkedRes.status === 409, 'DELETE /api/admin/suppliers/:id returns 409 Conflict when variants reference it');
    assert(
      typeof delLinkedRes.body.message === 'string' &&
        delLinkedRes.body.message.toLowerCase().includes('cannot delete supplier'),
      '409 response contains clear explanatory message'
    );

    const supAStillExists = await Supplier.findById(supplierA._id);
    assert(!!supAStillExists, 'Supplier A was NOT deleted from the database');

    // 3. Deleting an unlinked supplier (Supplier B) succeeds
    const delUnlinkedRes = await jsonRequest(
      'DELETE',
      `/api/admin/suppliers/${supplierB._id}`,
      undefined,
      adminCookie
    );
    assert(delUnlinkedRes.status === 200 && delUnlinkedRes.body.success, 'DELETE /api/admin/suppliers/:id returns 200 for unlinked Supplier B');

    const supBDeleted = await Supplier.findById(supplierB._id);
    assert(!supBDeleted, 'Supplier B is permanently removed from the database');

    // ── Phase 8: RBAC Verification ────────────────────────────────────────────
    console.log('\n--- Phase 8: RBAC Permissions ---');
    // Staff can read supplier products
    const staffReadRes = await jsonRequest(
      'GET',
      `/api/admin/suppliers/${supplierA._id}/products`,
      undefined,
      staffCookie
    );
    assert(staffReadRes.status === 200, 'Staff can read GET /api/admin/suppliers/:id/products (200 OK)');

    // Staff cannot delete supplier
    const staffDeleteRes = await jsonRequest(
      'DELETE',
      `/api/admin/suppliers/${supplierA._id}`,
      undefined,
      staffCookie
    );
    assert(staffDeleteRes.status === 403, 'Staff is forbidden from DELETE /api/admin/suppliers/:id (403 Forbidden)');

    // Customer cannot access admin supplier products or delete
    const custReadRes = await jsonRequest(
      'GET',
      `/api/admin/suppliers/${supplierA._id}/products`,
      undefined,
      customerCookie
    );
    assert(custReadRes.status === 403, 'Customer is forbidden from GET /api/admin/suppliers/:id/products (403 Forbidden)');

    const custDeleteRes = await jsonRequest(
      'DELETE',
      `/api/admin/suppliers/${supplierA._id}`,
      undefined,
      customerCookie
    );
    assert(custDeleteRes.status === 403, 'Customer is forbidden from DELETE /api/admin/suppliers/:id (403 Forbidden)');

    // Unauthenticated requests
    const unauthReadRes = await jsonRequest('GET', `/api/admin/suppliers/${supplierA._id}/products`);
    assert(unauthReadRes.status === 401, 'Unauthenticated GET /api/admin/suppliers/:id/products returns 401 Unauthorized');

    const unauthDeleteRes = await jsonRequest('DELETE', `/api/admin/suppliers/${supplierA._id}`);
    assert(unauthDeleteRes.status === 401, 'Unauthenticated DELETE /api/admin/suppliers/:id returns 401 Unauthorized');

  } catch (err) {
    console.error('Test run failed with error:', err);
    failedTests++;
  } finally {
    // ── Cleanup ───────────────────────────────────────────────────────────────
    console.log('\n--- Cleanup Test Fixtures ---');
    try {
      if (createdProductIds.length > 0) {
        await Product.deleteMany({ _id: { $in: createdProductIds } });
      }
      if (createdSupplierIds.length > 0) {
        await Supplier.deleteMany({ _id: { $in: createdSupplierIds } });
      }
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
      if (testCatId) await Category.findByIdAndDelete(testCatId);
      if (testDeptId) await Department.findByIdAndDelete(testDeptId);
      console.log('Cleaned up test products, suppliers, users, and category.');
    } catch (cleanErr) {
      console.error('Error during cleanup:', cleanErr);
    }

    if (server) {
      await new Promise<void>((res) => server.close(() => res()));
    }
    await mongoose.disconnect();
    console.log('Database disconnected and server stopped.');
  }

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log(`========================================\n`);

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
