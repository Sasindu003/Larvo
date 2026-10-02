import http from 'http';
import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import app from './src/app';
import { User } from './src/models/User';
import { Supplier } from './src/models/Supplier';

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

  // Start HTTP server on dynamic port
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

  try {
    // 1. Setup Test Users
    console.log('\n--- 1. Setting up test users ---');
    const timestamp = Date.now();

    const customer = await User.create({
      name: `P59 Customer ${timestamp}`,
      email: `p59_cust_${timestamp}@test.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
      role: 'customer',
    });
    createdUserIds.push(customer._id);
    const customerCookie = makeAuthCookie(customer._id.toString());

    const staff = await User.create({
      name: `P59 Staff ${timestamp}`,
      email: `p59_staff_${timestamp}@test.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
      role: 'staff',
    });
    createdUserIds.push(staff._id);
    const staffCookie = makeAuthCookie(staff._id.toString());

    const admin = await User.create({
      name: `P59 Admin ${timestamp}`,
      email: `p59_admin_${timestamp}@test.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
      role: 'admin',
    });
    createdUserIds.push(admin._id);
    const adminCookie = makeAuthCookie(admin._id.toString());

    assert(!!customer._id && !!staff._id && !!admin._id, 'Created customer, staff, and admin test users');

    // 2. Auth & RBAC Guards
    console.log('\n--- 2. Testing Auth and Role-Based Access Control ---');
    const unauthGetRes = await jsonRequest('GET', '/api/admin/suppliers');
    assert(unauthGetRes.status === 401, 'Unauthenticated GET /api/admin/suppliers returns 401 Unauthorized');

    const customerGetRes = await jsonRequest('GET', '/api/admin/suppliers', undefined, customerCookie);
    assert(customerGetRes.status === 403, 'Customer GET /api/admin/suppliers returns 403 Forbidden');

    const staffGetRes = await jsonRequest('GET', '/api/admin/suppliers', undefined, staffCookie);
    assert(staffGetRes.status === 200, 'Staff GET /api/admin/suppliers returns 200 OK');

    const staffPostRes = await jsonRequest(
      'POST',
      '/api/admin/suppliers',
      {
        companyName: 'Unauthorized Supplier Co',
        name: 'John Doe',
        email: `unauth_${timestamp}@supplier.com`,
        phone: '555-0000',
      },
      staffCookie
    );
    assert(staffPostRes.status === 403, 'Staff POST /api/admin/suppliers returns 403 Forbidden');

    // 3. Validation on Create
    console.log('\n--- 3. Testing Create Supplier Validation ---');
    const missingFieldsRes = await jsonRequest(
      'POST',
      '/api/admin/suppliers',
      { companyName: 'Incomplete Supplier' },
      adminCookie
    );
    assert(missingFieldsRes.status === 400, 'POST with missing required fields returns 400 Bad Request');

    const invalidEmailRes = await jsonRequest(
      'POST',
      '/api/admin/suppliers',
      {
        companyName: 'Bad Email Co',
        name: 'Bob',
        email: 'not-an-email',
        phone: '555-1234',
      },
      adminCookie
    );
    assert(invalidEmailRes.status === 400, 'POST with invalid email returns 400 Bad Request');

    // 4. Successful Creation (POST /api/admin/suppliers)
    console.log('\n--- 4. Testing Admin Supplier Creation ---');
    const createRes1 = await jsonRequest(
      'POST',
      '/api/admin/suppliers',
      {
        companyName: `Apex Textiles ${timestamp}`,
        name: 'Alice Jenkins',
        email: `alice_${timestamp}@apexfabrics.com`,
        phone: '+1 (555) 101-2001',
        address: '100 Industrial Parkway, Greenville, SC 29601',
        notes: 'Specializes in high-grade organic cotton and linen weaves.',
      },
      adminCookie
    );
    assert(createRes1.status === 201, 'Admin POST creates supplier (201 Created)');
    const sup1 = createRes1.body.data.supplier;
    createdSupplierIds.push(new Types.ObjectId(sup1._id));
    assert(sup1.companyName === `Apex Textiles ${timestamp}`, 'Supplier companyName correctly persisted');
    assert(sup1.status === 'active', 'New supplier defaults to active status');
    assert(sup1.name === 'Alice Jenkins', 'Contact person name correctly persisted');

    // Duplicate email conflict
    const duplicateEmailRes = await jsonRequest(
      'POST',
      '/api/admin/suppliers',
      {
        companyName: `Duplicate Test ${timestamp}`,
        name: 'Other Rep',
        email: `alice_${timestamp}@apexfabrics.com`,
        phone: '555-9999',
      },
      adminCookie
    );
    assert(duplicateEmailRes.status === 409, 'Creating supplier with duplicate email returns 409 Conflict');

    // Create supplier 2 (Pacific Weavers)
    const createRes2 = await jsonRequest(
      'POST',
      '/api/admin/suppliers',
      {
        companyName: `Pacific Weavers ${timestamp}`,
        name: 'Bob Chen',
        email: `bob_${timestamp}@pacificweavers.com`,
        phone: '+1 (555) 202-3002',
        address: '500 Harbor Blvd, Long Beach, CA 90802',
        notes: 'Outerwear, waterproof shells, and technical twills.',
      },
      adminCookie
    );
    assert(createRes2.status === 201, 'Created supplier 2 (Pacific Weavers)');
    const sup2 = createRes2.body.data.supplier;
    createdSupplierIds.push(new Types.ObjectId(sup2._id));

    // Create supplier 3 (Nordic Wool Co)
    const createRes3 = await jsonRequest(
      'POST',
      '/api/admin/suppliers',
      {
        companyName: `Nordic Wool Co ${timestamp}`,
        name: 'Clara Lind',
        email: `clara_${timestamp}@nordicwool.com`,
        phone: '+1 (555) 303-4003',
        address: '22 Fjord Way, Oslo, Norway',
        notes: 'Merino wool knits and heavy cashmere blends.',
      },
      adminCookie
    );
    assert(createRes3.status === 201, 'Created supplier 3 (Nordic Wool Co)');
    const sup3 = createRes3.body.data.supplier;
    createdSupplierIds.push(new Types.ObjectId(sup3._id));

    // 5. Multi-field Search Matching
    console.log('\n--- 5. Testing Multi-Field Search (Company, Name, Email) ---');
    // Search by companyName
    const searchCompanyRes = await jsonRequest(
      'GET',
      `/api/admin/suppliers?search=Apex+Textiles+${timestamp}`,
      undefined,
      staffCookie
    );
    assert(searchCompanyRes.status === 200, 'Search by companyName returns 200');
    assert(
      searchCompanyRes.body.data.results.length === 1 &&
        searchCompanyRes.body.data.results[0]._id === sup1._id,
      'Search by companyName matches Apex Textiles only'
    );

    // Search by contact name (case-insensitive)
    const searchNameRes = await jsonRequest(
      'GET',
      `/api/admin/suppliers?search=bob+chen`,
      undefined,
      staffCookie
    );
    assert(searchNameRes.status === 200, 'Search by contact name returns 200');
    const matchedBob = searchNameRes.body.data.results.find((s: any) => s._id === sup2._id);
    assert(!!matchedBob, 'Search matches contact person "Bob Chen"');

    // Search by email domain
    const searchEmailRes = await jsonRequest(
      'GET',
      `/api/admin/suppliers?search=nordicwool.com`,
      undefined,
      staffCookie
    );
    assert(searchEmailRes.status === 200, 'Search by email domain returns 200');
    const matchedNordic = searchEmailRes.body.data.results.find((s: any) => s._id === sup3._id);
    assert(!!matchedNordic, 'Search matches email "nordicwool.com"');

    // 6. GET /api/admin/suppliers/:id
    console.log('\n--- 6. Testing GET /api/admin/suppliers/:id ---');
    const getByIdRes = await jsonRequest('GET', `/api/admin/suppliers/${sup1._id}`, undefined, staffCookie);
    assert(getByIdRes.status === 200, 'GET supplier by ID returns 200 OK');
    assert(getByIdRes.body.data.supplier.companyName === `Apex Textiles ${timestamp}`, 'Supplier details match ID');

    const nonExistentRes = await jsonRequest(
      'GET',
      `/api/admin/suppliers/${new Types.ObjectId()}`,
      undefined,
      staffCookie
    );
    assert(nonExistentRes.status === 404, 'GET non-existent supplier returns 404 Not Found');

    // 7. Update Supplier (PATCH /api/admin/suppliers/:id)
    console.log('\n--- 7. Testing Update Supplier ---');
    const staffPatchRes = await jsonRequest(
      'PATCH',
      `/api/admin/suppliers/${sup1._id}`,
      { name: 'Alice Smith' },
      staffCookie
    );
    assert(staffPatchRes.status === 403, 'Staff PATCH supplier returns 403 Forbidden');

    const updateRes = await jsonRequest(
      'PATCH',
      `/api/admin/suppliers/${sup1._id}`,
      {
        name: 'Alice Jenkins-Smith',
        phone: '+1 (555) 999-8888',
        notes: 'Updated contact person and direct line.',
      },
      adminCookie
    );
    assert(updateRes.status === 200, 'Admin PATCH supplier returns 200 OK');
    assert(updateRes.body.data.supplier.name === 'Alice Jenkins-Smith', 'Updated name persisted');
    assert(updateRes.body.data.supplier.phone === '+1 (555) 999-8888', 'Updated phone persisted');
    assert(updateRes.body.data.supplier.notes === 'Updated contact person and direct line.', 'Updated notes persisted');

    // 8. Deactivation (PATCH /api/admin/suppliers/:id/deactivate)
    console.log('\n--- 8. Testing Supplier Deactivation & Status Filtering ---');
    const staffDeactRes = await jsonRequest(
      'PATCH',
      `/api/admin/suppliers/${sup2._id}/deactivate`,
      {},
      staffCookie
    );
    assert(staffDeactRes.status === 403, 'Staff PATCH deactivate returns 403 Forbidden');

    const deactRes = await jsonRequest(
      'PATCH',
      `/api/admin/suppliers/${sup2._id}/deactivate`,
      {},
      adminCookie
    );
    assert(deactRes.status === 200, 'Admin PATCH deactivate returns 200 OK');
    assert(deactRes.body.data.supplier.status === 'inactive', 'Supplier status set to inactive');

    // Verify status=active excludes deactivated supplier
    const activeListRes = await jsonRequest(
      'GET',
      '/api/admin/suppliers?status=active',
      undefined,
      staffCookie
    );
    assert(activeListRes.status === 200, 'GET /api/admin/suppliers?status=active returns 200');
    const foundDeactivatedInActive = activeListRes.body.data.results.find((s: any) => s._id === sup2._id);
    assert(!foundDeactivatedInActive, 'Deactivated supplier is excluded from status=active query (P60/P61 requirement)');

    // Verify status=all includes deactivated supplier
    const allListRes = await jsonRequest(
      'GET',
      '/api/admin/suppliers?status=all',
      undefined,
      staffCookie
    );
    assert(allListRes.status === 200, 'GET /api/admin/suppliers?status=all returns 200');
    const foundDeactivatedInAll = allListRes.body.data.results.find((s: any) => s._id === sup2._id);
    assert(!!foundDeactivatedInAll, 'Deactivated supplier remains viewable in directory with status=all');

    // Verify deactivated supplier can still be viewed by ID
    const getDeactivatedRes = await jsonRequest(
      'GET',
      `/api/admin/suppliers/${sup2._id}`,
      undefined,
      staffCookie
    );
    assert(getDeactivatedRes.status === 200, 'Deactivated supplier is viewable via GET by ID');
    assert(getDeactivatedRes.body.data.supplier.status === 'inactive', 'Shows inactive status on detail view');

    // 9. Pagination Verification
    console.log('\n--- 9. Testing Pagination ---');
    const pagedRes = await jsonRequest(
      'GET',
      '/api/admin/suppliers?page=1&limit=2',
      undefined,
      staffCookie
    );
    assert(pagedRes.status === 200, 'GET with pagination returns 200');
    assert(pagedRes.body.data.results.length <= 2, 'Results obey limit parameter');
    assert(typeof pagedRes.body.data.total === 'number', 'Total count returned');
    assert(typeof pagedRes.body.data.pages === 'number', 'Total pages returned');
    assert(pagedRes.body.data.page === 1, 'Current page returned');

  } finally {
    console.log('\n--- Cleaning up test artifacts ---');
    if (createdSupplierIds.length > 0) {
      await Supplier.deleteMany({ _id: { $in: createdSupplierIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    console.log('Cleanup completed.');

    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await mongoose.disconnect();
  }

  console.log('\n========================================');
  console.log(`TOTAL TESTS: ${totalTests}`);
  console.log(`PASSED:      ${passedTests}`);
  console.log(`FAILED:      ${failedTests}`);
  console.log('========================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
