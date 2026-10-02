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
import {
  PurchaseOrder,
  PO_STATUSES,
  PO_VALID_TRANSITIONS,
} from './src/models/PurchaseOrder';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_1234567890_super_secret';
const MONGODB_URI = (process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/shop').replace('localhost', '127.0.0.1');

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
  const createdPOIds: Types.ObjectId[] = [];
  let testDeptId: Types.ObjectId | null = null;
  let testCatId: Types.ObjectId | null = null;

  try {
    console.log('\n=== P61 VERIFICATION: PURCHASE ORDER MODEL & CRUD ===\n');

    // ── Phase 1: Model & Schema Verification ─────────────────────────────────
    console.log('--- Phase 1: Model & Schema Verification ---');
    const supplierPath = (PurchaseOrder.schema as any).path('supplier');
    assert(!!supplierPath, 'PurchaseOrder schema contains supplier path');
    assert(supplierPath.options.ref === 'Supplier', 'PurchaseOrder supplier references Supplier model');

    const itemsPath = (PurchaseOrder.schema as any).path('items');
    assert(!!itemsPath, 'PurchaseOrder schema contains items path');

    assert(PO_STATUSES.length === 7, 'PO_STATUSES defines exactly 7 statuses');
    assert(PO_STATUSES.includes('draft'), 'PO_STATUSES includes draft');
    assert(PO_STATUSES.includes('in_transit'), 'PO_STATUSES includes in_transit');
    assert(PO_STATUSES.includes('cancelled'), 'PO_STATUSES includes cancelled');

    assert(Array.isArray(PO_VALID_TRANSITIONS['draft']), 'PO_VALID_TRANSITIONS defines transitions for draft');
    assert(PO_VALID_TRANSITIONS['draft'].includes('submitted'), 'draft can advance to submitted');
    assert(PO_VALID_TRANSITIONS['draft'].includes('cancelled'), 'draft can transition to cancelled');
    assert(!PO_VALID_TRANSITIONS['in_transit'].includes('cancelled'), 'in_transit cannot transition to cancelled');

    // ── Phase 2: Setup Test Fixtures ──────────────────────────────────────────
    console.log('\n--- Phase 2: Test Fixtures Setup ---');
    const adminUser = await User.create({
      name: 'P61 Admin',
      email: `p61_admin_${Date.now()}@larvo.com`,
      passwordHash: '$2a$10$dummyhashfortestingonly1234567890',
      role: 'admin',
    });
    createdUserIds.push(adminUser._id);
    const adminCookie = makeAuthCookie(adminUser._id.toString());

    const staffUser = await User.create({
      name: 'P61 Staff',
      email: `p61_staff_${Date.now()}@larvo.com`,
      passwordHash: '$2a$10$dummyhashfortestingonly1234567890',
      role: 'staff',
    });
    createdUserIds.push(staffUser._id);
    const staffCookie = makeAuthCookie(staffUser._id.toString());

    const customerUser = await User.create({
      name: 'P61 Customer',
      email: `p61_cust_${Date.now()}@larvo.com`,
      passwordHash: '$2a$10$dummyhashfortestingonly1234567890',
      role: 'customer',
    });
    createdUserIds.push(customerUser._id);
    const customerCookie = makeAuthCookie(customerUser._id.toString());

    const supplierA = await Supplier.create({
      name: 'Alpha Textiles Rep',
      companyName: 'Alpha Textiles Corp',
      email: `alpha_${Date.now()}@textiles.com`,
      phone: '+1-555-0101',
      status: 'active',
    });
    createdSupplierIds.push(supplierA._id);

    const supplierB = await Supplier.create({
      name: 'Beta Fabrics Rep',
      companyName: 'Beta Fabrics Ltd',
      email: `beta_${Date.now()}@fabrics.com`,
      phone: '+1-555-0202',
      status: 'active',
    });
    createdSupplierIds.push(supplierB._id);

    const dept = await Department.create({
      name: `P61 Apparel ${Date.now()}`,
      slug: `p61-apparel-${Date.now()}`,
      image: 'https://images.unsplash.com/photo-dept',
    });
    testDeptId = dept._id;

    const cat = await Category.create({
      name: `P61 Tops ${Date.now()}`,
      slug: `p61-tops-${Date.now()}`,
      department: dept._id,
      image: 'https://images.unsplash.com/photo-cat',
    });
    testCatId = cat._id;

    const testProduct = await Product.create({
      name: 'P61 Oxford Shirt',
      slug: `p61-oxford-shirt-${Date.now()}`,
      description: 'Premium cotton oxford button-down shirt',
      category: cat._id,
      images: ['https://images.unsplash.com/photo-shirt'],
      basePrice: 59.99,
      status: 'active',
      variants: [
        {
          size: 'M',
          color: 'Blue',
          material: 'Cotton',
          sku: `P61-OXF-BLU-M-${Date.now()}`,
          stock: 25,
          supplier: supplierA._id,
        },
        {
          size: 'L',
          color: 'White',
          material: 'Cotton',
          sku: `P61-OXF-WHT-L-${Date.now()}`,
          stock: 10,
          supplier: supplierA._id,
        },
      ],
    });
    createdProductIds.push(testProduct._id);

    const validSku1 = testProduct.variants[0].sku;
    const validSku2 = testProduct.variants[1].sku;

    // ── Phase 3: Create Purchase Order (POST /api/admin/purchase-orders) ───────
    console.log('\n--- Phase 3: Create Purchase Order ---');

    // Success create
    const createRes = await jsonRequest(
      'POST',
      '/api/admin/purchase-orders',
      {
        supplier: supplierA._id.toString(),
        items: [
          {
            product: testProduct._id.toString(),
            sku: validSku1,
            size: 'M',
            color: 'Blue',
            orderedQty: 50,
            unitCost: 20.0,
          },
          {
            product: testProduct._id.toString(),
            sku: validSku2,
            size: 'L',
            color: 'White',
            orderedQty: 30,
            unitCost: 22.5,
          },
        ],
        expectedDeliveryDate: new Date(Date.now() + 86400000 * 7).toISOString(),
        notes: 'Priority air shipment requested',
      },
      adminCookie
    );

    assert(createRes.status === 201, 'POST /api/admin/purchase-orders returns 201');
    assert(createRes.body.success === true, 'Response body success is true');
    const createdPO = createRes.body.data?.purchaseOrder;
    assert(!!createdPO?._id, 'Created PO has an _id');
    if (createdPO?._id) createdPOIds.push(new Types.ObjectId(createdPO._id));
    assert(createdPO?.status === 'draft', 'Newly created PO defaults to "draft" status');
    assert(createdPO?.items?.length === 2, 'PO has 2 line items');
    assert(createdPO?.totalCost === 50 * 20.0 + 30 * 22.5, 'totalCost virtual correctly sums orderedQty * unitCost');
    assert(createdPO?.supplier?.name === 'Alpha Textiles Rep', 'Supplier is populated');

    // ── Phase 4: Referential Integrity Validations ────────────────────────────
    console.log('\n--- Phase 4: Referential Integrity Validations ---');

    // Invalid / non-existent supplier
    const invalidSupplierRes = await jsonRequest(
      'POST',
      '/api/admin/purchase-orders',
      {
        supplier: new Types.ObjectId().toString(),
        items: [
          {
            product: testProduct._id.toString(),
            sku: validSku1,
            size: 'M',
            color: 'Blue',
            orderedQty: 10,
            unitCost: 15.0,
          },
        ],
      },
      adminCookie
    );
    assert(invalidSupplierRes.status === 400, 'Non-existent supplier rejects with 400');
    assert(invalidSupplierRes.body.message.includes('Supplier not found'), 'Error states supplier not found');

    // Invalid / non-existent product
    const invalidProductRes = await jsonRequest(
      'POST',
      '/api/admin/purchase-orders',
      {
        supplier: supplierA._id.toString(),
        items: [
          {
            product: new Types.ObjectId().toString(),
            sku: validSku1,
            size: 'M',
            color: 'Blue',
            orderedQty: 10,
            unitCost: 15.0,
          },
        ],
      },
      adminCookie
    );
    assert(invalidProductRes.status === 400, 'Non-existent product rejects with 400');

    // Invalid SKU on product
    const invalidSkuRes = await jsonRequest(
      'POST',
      '/api/admin/purchase-orders',
      {
        supplier: supplierA._id.toString(),
        items: [
          {
            product: testProduct._id.toString(),
            sku: 'FAKE-NONEXISTENT-SKU',
            size: 'M',
            color: 'Blue',
            orderedQty: 10,
            unitCost: 15.0,
          },
        ],
      },
      adminCookie
    );
    assert(invalidSkuRes.status === 400, 'Non-existent SKU on product rejects with 400');
    assert(invalidSkuRes.body.message.includes('does not exist on product'), 'Error message specifies SKU mismatch');

    // ── Phase 5: Get & Filter Purchase Orders ─────────────────────────────────
    console.log('\n--- Phase 5: List & Query Purchase Orders ---');

    const listRes = await jsonRequest('GET', '/api/admin/purchase-orders', undefined, adminCookie);
    assert(listRes.status === 200, 'GET /api/admin/purchase-orders returns 200');
    assert(Array.isArray(listRes.body.data?.results), 'Results is an array');
    assert(typeof listRes.body.data?.total === 'number', 'Total is a number');

    const filterStatusRes = await jsonRequest(
      'GET',
      '/api/admin/purchase-orders?status=draft',
      undefined,
      adminCookie
    );
    assert(filterStatusRes.status === 200, 'Filter by status returns 200');
    assert(
      filterStatusRes.body.data?.results.every((p: any) => p.status === 'draft'),
      'All returned POs have status=draft'
    );

    const filterSupplierRes = await jsonRequest(
      'GET',
      `/api/admin/purchase-orders?supplier=${supplierA._id.toString()}`,
      undefined,
      adminCookie
    );
    assert(filterSupplierRes.status === 200, 'Filter by supplier returns 200');

    const getSingleRes = await jsonRequest(
      'GET',
      `/api/admin/purchase-orders/${createdPO._id}`,
      undefined,
      adminCookie
    );
    assert(getSingleRes.status === 200, 'GET /api/admin/purchase-orders/:id returns 200');
    assert(getSingleRes.body.data?.purchaseOrder?._id === createdPO._id, 'Returned PO ID matches');

    // ── Phase 6: Update Draft PO ──────────────────────────────────────────────
    console.log('\n--- Phase 6: Update Purchase Order (Draft Only) ---');

    const updateRes = await jsonRequest(
      'PATCH',
      `/api/admin/purchase-orders/${createdPO._id}`,
      {
        notes: 'Updated note: delivery window confirmed',
        items: [
          {
            product: testProduct._id.toString(),
            sku: validSku1,
            size: 'M',
            color: 'Blue',
            orderedQty: 100,
            unitCost: 19.5,
          },
        ],
      },
      adminCookie
    );
    assert(updateRes.status === 200, 'PATCH /api/admin/purchase-orders/:id updates draft PO (200)');
    assert(updateRes.body.data?.purchaseOrder?.notes === 'Updated note: delivery window confirmed', 'Notes updated');
    assert(updateRes.body.data?.purchaseOrder?.items?.length === 1, 'Items replaced with 1 item');
    assert(updateRes.body.data?.purchaseOrder?.totalCost === 100 * 19.5, 'totalCost updated to 1950');

    // ── Phase 7: Linear Status Transitions ────────────────────────────────────
    console.log('\n--- Phase 7: Linear Status Transitions ---');

    // Advance: draft -> submitted
    const advSubmitted = await jsonRequest(
      'PATCH',
      `/api/admin/purchase-orders/${createdPO._id}/status`,
      { status: 'submitted' },
      adminCookie
    );
    assert(advSubmitted.status === 200, 'draft -> submitted succeeds (200)');
    assert(advSubmitted.body.data?.purchaseOrder?.status === 'submitted', 'Status is now submitted');

    // Now that PO is submitted, updates to its items/supplier should be blocked
    const updateBlockedRes = await jsonRequest(
      'PATCH',
      `/api/admin/purchase-orders/${createdPO._id}`,
      { notes: 'Illegal attempt to edit non-draft PO' },
      adminCookie
    );
    assert(updateBlockedRes.status === 400, 'Editing submitted PO rejects with 400');
    assert(updateBlockedRes.body.message.includes('Only draft purchase orders can be edited'), 'Error specifies draft only');

    // Illegal skip: submitted -> received (should fail, only confirmed or cancelled allowed)
    const illegalSkipRes = await jsonRequest(
      'PATCH',
      `/api/admin/purchase-orders/${createdPO._id}/status`,
      { status: 'received' },
      adminCookie
    );
    assert(illegalSkipRes.status === 400, 'Illegal transition (submitted -> received) rejects with 400');

    // Advance: submitted -> confirmed
    const advConfirmed = await jsonRequest(
      'PATCH',
      `/api/admin/purchase-orders/${createdPO._id}/status`,
      { status: 'confirmed' },
      adminCookie
    );
    assert(advConfirmed.status === 200, 'submitted -> confirmed succeeds (200)');

    // Advance: confirmed -> in_transit
    const advInTransit = await jsonRequest(
      'PATCH',
      `/api/admin/purchase-orders/${createdPO._id}/status`,
      { status: 'in_transit' },
      adminCookie
    );
    assert(advInTransit.status === 200, 'confirmed -> in_transit succeeds (200)');
    assert(advInTransit.body.data?.purchaseOrder?.status === 'in_transit', 'Status is now in_transit');

    // Advance: in_transit -> partially_received
    const advPartiallyReceived = await jsonRequest(
      'PATCH',
      `/api/admin/purchase-orders/${createdPO._id}/status`,
      { status: 'partially_received' },
      adminCookie
    );
    assert(advPartiallyReceived.status === 200, 'in_transit -> partially_received succeeds (200)');

    // Advance: partially_received -> received
    const advReceived = await jsonRequest(
      'PATCH',
      `/api/admin/purchase-orders/${createdPO._id}/status`,
      { status: 'received' },
      adminCookie
    );
    assert(advReceived.status === 200, 'partially_received -> received succeeds (200)');
    assert(advReceived.body.data?.purchaseOrder?.status === 'received', 'Status is now received');

    // Terminal state: received cannot transition anywhere
    const terminalRes = await jsonRequest(
      'PATCH',
      `/api/admin/purchase-orders/${createdPO._id}/status`,
      { status: 'draft' },
      adminCookie
    );
    assert(terminalRes.status === 400, 'Transition from received back to draft rejects with 400');

    // ── Phase 8: Cancellation Rules ───────────────────────────────────────────
    console.log('\n--- Phase 8: Cancellation Rules ---');

    // Test cancellation of in_transit or later PO: createdPO is currently 'received', should reject
    const cancelReceivedRes = await jsonRequest(
      'PATCH',
      `/api/admin/purchase-orders/${createdPO._id}/cancel`,
      undefined,
      adminCookie
    );
    assert(cancelReceivedRes.status === 400, 'Cancel on received PO rejects with 400');

    // Create a new PO and advance it to in_transit, then try cancelling -> must reject with 400
    const inTransitPOCreate = await jsonRequest(
      'POST',
      '/api/admin/purchase-orders',
      {
        supplier: supplierB._id.toString(),
        items: [
          {
            product: testProduct._id.toString(),
            sku: validSku1,
            size: 'M',
            color: 'Blue',
            orderedQty: 20,
            unitCost: 20.0,
          },
        ],
      },
      adminCookie
    );
    const inTransitPOId = inTransitPOCreate.body.data.purchaseOrder._id;
    createdPOIds.push(new Types.ObjectId(inTransitPOId));

    // Advance to in_transit
    await jsonRequest('PATCH', `/api/admin/purchase-orders/${inTransitPOId}/status`, { status: 'submitted' }, adminCookie);
    await jsonRequest('PATCH', `/api/admin/purchase-orders/${inTransitPOId}/status`, { status: 'confirmed' }, adminCookie);
    await jsonRequest('PATCH', `/api/admin/purchase-orders/${inTransitPOId}/status`, { status: 'in_transit' }, adminCookie);

    const cancelInTransitRes = await jsonRequest(
      'PATCH',
      `/api/admin/purchase-orders/${inTransitPOId}/cancel`,
      undefined,
      adminCookie
    );
    assert(cancelInTransitRes.status === 400, 'Cancel on in_transit PO rejects with 400 (P61 acceptance criterion)');
    assert(cancelInTransitRes.body.message.includes('Cannot cancel a purchase order with status \'in_transit\''), 'Error indicates in_transit is uncancellable');

    // Now test valid cancellations from draft, submitted, confirmed:
    // 1. Cancel from draft
    const draftPO = await jsonRequest(
      'POST',
      '/api/admin/purchase-orders',
      {
        supplier: supplierA._id.toString(),
        items: [{ product: testProduct._id.toString(), sku: validSku1, size: 'M', color: 'Blue', orderedQty: 5, unitCost: 10 }],
      },
      adminCookie
    );
    const draftPOId = draftPO.body.data.purchaseOrder._id;
    createdPOIds.push(new Types.ObjectId(draftPOId));

    const cancelDraftRes = await jsonRequest('PATCH', `/api/admin/purchase-orders/${draftPOId}/cancel`, undefined, adminCookie);
    assert(cancelDraftRes.status === 200, 'Cancel on draft PO succeeds (200)');
    assert(cancelDraftRes.body.data?.purchaseOrder?.status === 'cancelled', 'Status is now cancelled');

    // 2. Cancel from submitted
    const submittedPO = await jsonRequest(
      'POST',
      '/api/admin/purchase-orders',
      {
        supplier: supplierA._id.toString(),
        items: [{ product: testProduct._id.toString(), sku: validSku1, size: 'M', color: 'Blue', orderedQty: 5, unitCost: 10 }],
      },
      adminCookie
    );
    const subPOId = submittedPO.body.data.purchaseOrder._id;
    createdPOIds.push(new Types.ObjectId(subPOId));
    await jsonRequest('PATCH', `/api/admin/purchase-orders/${subPOId}/status`, { status: 'submitted' }, adminCookie);

    const cancelSubRes = await jsonRequest('PATCH', `/api/admin/purchase-orders/${subPOId}/cancel`, undefined, adminCookie);
    assert(cancelSubRes.status === 200, 'Cancel on submitted PO succeeds (200)');
    assert(cancelSubRes.body.data?.purchaseOrder?.status === 'cancelled', 'Status is now cancelled');

    // 3. Cancel from confirmed
    const confirmedPO = await jsonRequest(
      'POST',
      '/api/admin/purchase-orders',
      {
        supplier: supplierA._id.toString(),
        items: [{ product: testProduct._id.toString(), sku: validSku1, size: 'M', color: 'Blue', orderedQty: 5, unitCost: 10 }],
      },
      adminCookie
    );
    const confPOId = confirmedPO.body.data.purchaseOrder._id;
    createdPOIds.push(new Types.ObjectId(confPOId));
    await jsonRequest('PATCH', `/api/admin/purchase-orders/${confPOId}/status`, { status: 'submitted' }, adminCookie);
    await jsonRequest('PATCH', `/api/admin/purchase-orders/${confPOId}/status`, { status: 'confirmed' }, adminCookie);

    const cancelConfRes = await jsonRequest('PATCH', `/api/admin/purchase-orders/${confPOId}/cancel`, undefined, adminCookie);
    assert(cancelConfRes.status === 200, 'Cancel on confirmed PO succeeds (200)');
    assert(cancelConfRes.body.data?.purchaseOrder?.status === 'cancelled', 'Status is now cancelled');

    // ── Phase 9: Authorization & RBAC ─────────────────────────────────────────
    console.log('\n--- Phase 9: Authorization & RBAC ---');

    const customerReq = await jsonRequest('GET', '/api/admin/purchase-orders', undefined, customerCookie);
    assert(customerReq.status === 403, 'Customer role cannot access admin purchase orders (403)');

    const staffReq = await jsonRequest('GET', '/api/admin/purchase-orders', undefined, staffCookie);
    assert(staffReq.status === 403, 'Staff role cannot access admin purchase orders (403 - admin/owner only)');

    const anonReq = await jsonRequest('GET', '/api/admin/purchase-orders');
    assert(anonReq.status === 401, 'Unauthenticated request receives 401');

  } catch (err) {
    console.error('Test execution exception:', err);
    failedTests++;
  } finally {
    console.log('\n--- Cleaning up test fixtures ---');
    if (createdPOIds.length > 0) {
      await PurchaseOrder.deleteMany({ _id: { $in: createdPOIds } });
    }
    if (createdProductIds.length > 0) {
      await Product.deleteMany({ _id: { $in: createdProductIds } });
    }
    if (testCatId) {
      await Category.findByIdAndDelete(testCatId);
    }
    if (testDeptId) {
      await Department.findByIdAndDelete(testDeptId);
    }
    if (createdSupplierIds.length > 0) {
      await Supplier.deleteMany({ _id: { $in: createdSupplierIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }

    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await mongoose.disconnect();
    console.log('Cleaned up and disconnected.');

    console.log(`\n========================================`);
    console.log(`TOTAL TESTS: ${totalTests}`);
    console.log(`PASSED: ${passedTests}`);
    console.log(`FAILED: ${failedTests}`);
    console.log(`========================================\n`);

    if (failedTests > 0) {
      process.exit(1);
    }
  }
}

runTests();