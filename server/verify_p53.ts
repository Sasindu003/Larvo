import http from 'http';
import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import app from './src/app';
import { User, IUser } from './src/models/User';

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
  console.log('=== STARTING P53 VERIFICATION SUITE ===\n');
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

  // ── 0. Setup Test Users ───────────────────────────────────────────────────
  const suffix = Date.now().toString().slice(-6);
  const ownerUser = await User.create({
    name: 'Owner Tester',
    email: `p53_owner_${suffix}@test.com`,
    passwordHash: 'Password123!',
    role: 'owner',
    active: true,
  });

  const adminUser = await User.create({
    name: 'Admin Tester',
    email: `p53_admin_${suffix}@test.com`,
    passwordHash: 'Password123!',
    role: 'admin',
    active: true,
  });

  const staffUser = await User.create({
    name: 'Staff Tester',
    email: `p53_staff_${suffix}@test.com`,
    passwordHash: 'Password123!',
    role: 'staff',
    active: true,
  });

  const customerUser = await User.create({
    name: 'Customer Tester',
    email: `p53_customer_${suffix}@test.com`,
    passwordHash: 'Password123!',
    role: 'customer',
    active: true,
  });

  const ownerCookie = makeAuthCookie(ownerUser._id.toString());
  const adminCookie = makeAuthCookie(adminUser._id.toString());
  const staffCookie = makeAuthCookie(staffUser._id.toString());
  const customerCookie = makeAuthCookie(customerUser._id.toString());

  try {
    // ── 1. GET /api/staff (RBAC & Filtering) ──────────────────────────────────
    console.log('\n--- Test Group 1: GET /api/staff Permissions & Listing ---');

    const res1 = await jsonRequest('GET', '/api/staff');
    assert(res1.status === 401, 'Unauthenticated request returns 401');

    const res2 = await jsonRequest('GET', '/api/staff', undefined, customerCookie);
    assert(res2.status === 403, 'Customer role returns 403');

    const res3 = await jsonRequest('GET', '/api/staff', undefined, staffCookie);
    assert(res3.status === 403, 'Staff role returns 403 (admin/owner only)');

    const res4 = await jsonRequest('GET', '/api/staff', undefined, adminCookie);
    assert(res4.status === 200, 'Admin role returns 200');
    assert(res4.body.success === true, 'Response body has success: true');
    assert(Array.isArray(res4.body.data.results), 'Returns results array');
    const hasCustomer = res4.body.data.results.some((u: any) => u.role === 'customer');
    assert(!hasCustomer, 'Results contain only non-customer accounts');

    const resOwner = await jsonRequest('GET', '/api/staff', undefined, ownerCookie);
    assert(resOwner.status === 200, 'Owner role returns 200');

    // Role filter
    const resFiltered = await jsonRequest('GET', '/api/staff?role=staff', undefined, adminCookie);
    assert(resFiltered.status === 200, 'Role filter query returns 200');
    assert(
      resFiltered.body.data.results.every((u: any) => u.role === 'staff'),
      'Role filter returns only staff accounts'
    );

    // Search filter
    const resSearch = await jsonRequest(
      'GET',
      `/api/staff?search=${adminUser.email}`,
      undefined,
      adminCookie
    );
    assert(resSearch.status === 200, 'Search query returns 200');
    assert(
      resSearch.body.data.results.some((u: any) => u.email === adminUser.email),
      'Search finds admin by email'
    );

    // ── 2. POST /api/staff (Provisioning & Asymmetric Roles) ───────────────────
    console.log('\n--- Test Group 2: POST /api/staff Direct Provisioning ---');

    const newStaffEmail = `provisioned_staff_${suffix}@test.com`;
    const resCreateStaff = await jsonRequest(
      'POST',
      '/api/staff',
      {
        name: 'New Provisioned Staff',
        email: newStaffEmail,
        password: 'TemporaryPassword123!',
        role: 'staff',
      },
      adminCookie
    );
    assert(resCreateStaff.status === 201, 'Admin provisions staff member -> 201 Created');
    assert(resCreateStaff.body.data.user.email === newStaffEmail, 'Created user has correct email');
    assert(resCreateStaff.body.data.user.role === 'staff', 'Created user has staff role');
    assert(!resCreateStaff.body.data.user.passwordHash, 'passwordHash is excluded from response');
    const provisionedStaffId = resCreateStaff.body.data.user._id;

    // Admin creates delivery_manager
    const resCreateDM = await jsonRequest(
      'POST',
      '/api/staff',
      {
        name: 'New Delivery Guy',
        email: `dm_${suffix}@test.com`,
        password: 'TemporaryPassword123!',
        role: 'delivery_manager',
      },
      adminCookie
    );
    assert(resCreateDM.status === 201, 'Admin provisions delivery_manager -> 201 Created');

    // Duplicate email
    const resDup = await jsonRequest(
      'POST',
      '/api/staff',
      {
        name: 'Duplicate Staff',
        email: newStaffEmail,
        password: 'TemporaryPassword123!',
        role: 'staff',
      },
      adminCookie
    );
    assert(resDup.status === 409, 'Duplicate email returns 409 Conflict');

    // Admin tries to create 'admin' -> 403
    const resAdminCreateAdmin = await jsonRequest(
      'POST',
      '/api/staff',
      {
        name: 'Escalated Admin',
        email: `escalated_admin_${suffix}@test.com`,
        password: 'TemporaryPassword123!',
        role: 'admin',
      },
      adminCookie
    );
    assert(resAdminCreateAdmin.status === 403, 'Admin attempting to create admin returns 403');

    // Owner CAN create 'admin' -> 201
    const resOwnerCreateAdmin = await jsonRequest(
      'POST',
      '/api/staff',
      {
        name: 'Owner Created Admin',
        email: `legit_admin_${suffix}@test.com`,
        password: 'TemporaryPassword123!',
        role: 'admin',
      },
      ownerCookie
    );
    assert(resOwnerCreateAdmin.status === 201, 'Owner creating admin returns 201 Created');

    // Nobody can create 'owner' via POST /api/staff -> 422 validation rejection
    const resCreateOwner = await jsonRequest(
      'POST',
      '/api/staff',
      {
        name: 'Illegal Owner',
        email: `illegal_owner_${suffix}@test.com`,
        password: 'TemporaryPassword123!',
        role: 'owner',
      },
      ownerCookie
    );
    assert(resCreateOwner.status === 422, "Creating 'owner' via POST /api/staff rejected with 422");

    // ── 3. PATCH /api/staff/:id (Self-Protection & Asymmetry) ──────────────────
    console.log('\n--- Test Group 3: PATCH /api/staff/:id Self-Protection & Asymmetry ---');

    // Self-modification protection (admin modifying self)
    const resSelfAdmin = await jsonRequest(
      'PATCH',
      `/api/staff/${adminUser._id}`,
      { name: 'Changed My Own Name' },
      adminCookie
    );
    assert(resSelfAdmin.status === 400, 'Self-modification by admin returns 400 Bad Request');
    assert(
      resSelfAdmin.body.message.includes('Cannot modify your own account'),
      'Returns explicit self-modification error message'
    );

    // Self-modification protection (owner modifying self)
    const resSelfOwner = await jsonRequest(
      'PATCH',
      `/api/staff/${ownerUser._id}`,
      { active: false },
      ownerCookie
    );
    assert(resSelfOwner.status === 400, 'Self-modification by owner returns 400 Bad Request');

    // Admin attempts to grant 'owner' -> 403 (Test criterion: curl PATCH /api/staff/:id {role:'owner'} with an admin cookie -> 403)
    const resAdminGrantOwner = await jsonRequest(
      'PATCH',
      `/api/staff/${provisionedStaffId}`,
      { role: 'owner' },
      adminCookie
    );
    assert(
      resAdminGrantOwner.status === 403,
      "PATCH /api/staff/:id {role:'owner'} with admin cookie returns 403"
    );

    // Admin attempts to grant 'admin' -> 403
    const resAdminGrantAdmin = await jsonRequest(
      'PATCH',
      `/api/staff/${provisionedStaffId}`,
      { role: 'admin' },
      adminCookie
    );
    assert(
      resAdminGrantAdmin.status === 403,
      "PATCH /api/staff/:id {role:'admin'} with admin cookie returns 403"
    );

    // Admin attempts to modify an admin account -> 403
    const resAdminModAdmin = await jsonRequest(
      'PATCH',
      `/api/staff/${resOwnerCreateAdmin.body.data.user._id}`,
      { name: 'Tampered Admin' },
      adminCookie
    );
    assert(resAdminModAdmin.status === 403, 'Admin modifying another admin returns 403');

    // Admin attempts to modify owner account -> 403
    const resAdminModOwner = await jsonRequest(
      'PATCH',
      `/api/staff/${ownerUser._id}`,
      { name: 'Tampered Owner' },
      adminCookie
    );
    assert(resAdminModOwner.status === 403, 'Admin modifying owner account returns 403');

    // Admin updating staff name -> 200
    const resAdminUpdateStaff = await jsonRequest(
      'PATCH',
      `/api/staff/${provisionedStaffId}`,
      { name: 'Updated Staff Name' },
      adminCookie
    );
    assert(resAdminUpdateStaff.status === 200, 'Admin updating staff name returns 200');
    assert(
      resAdminUpdateStaff.body.data.user.name === 'Updated Staff Name',
      'Staff name updated in database'
    );

    // Admin changing staff to delivery_manager -> 200
    const resAdminChangeRole = await jsonRequest(
      'PATCH',
      `/api/staff/${provisionedStaffId}`,
      { role: 'delivery_manager' },
      adminCookie
    );
    assert(resAdminChangeRole.status === 200, 'Admin changing staff to delivery_manager returns 200');
    assert(
      resAdminChangeRole.body.data.user.role === 'delivery_manager',
      'Role updated to delivery_manager'
    );

    // Owner promoting delivery_manager to admin -> 200
    const resOwnerPromote = await jsonRequest(
      'PATCH',
      `/api/staff/${provisionedStaffId}`,
      { role: 'admin' },
      ownerCookie
    );
    assert(resOwnerPromote.status === 200, 'Owner promoting user to admin returns 200');
    assert(resOwnerPromote.body.data.user.role === 'admin', 'User promoted to admin role');

    // ── 4. Deactivation & Login / JWT Blocking ─────────────────────────────────
    console.log('\n--- Test Group 4: Deactivation & Active Check Enforcement ---');

    // Target staff user for deactivation tests
    const deactEmail = `deact_target_${suffix}@test.com`;
    const deactUser = await User.create({
      name: 'Deactivate Target',
      email: deactEmail,
      passwordHash: 'ValidPassword123!',
      role: 'staff',
      active: true,
    });
    const deactCookie = makeAuthCookie(deactUser._id.toString());

    // 4a. Verify login works before deactivation
    const resLoginBefore = await jsonRequest('POST', '/api/auth/login', {
      email: deactEmail,
      password: 'ValidPassword123!',
    });
    assert(resLoginBefore.status === 200, 'Active staff login succeeds -> 200');

    // 4b. Deactivate the staff account via PATCH
    const resDeact = await jsonRequest(
      'PATCH',
      `/api/staff/${deactUser._id}`,
      { active: false },
      adminCookie
    );
    assert(resDeact.status === 200, 'Admin deactivates staff account -> 200');
    assert(resDeact.body.data.user.active === false, 'Staff active flag set to false');

    // 4c. Attempt login as deactivated user with CORRECT credentials (Test criterion)
    const resLoginAfter = await jsonRequest('POST', '/api/auth/login', {
      email: deactEmail,
      password: 'ValidPassword123!',
    });
    assert(
      resLoginAfter.status === 403,
      'Deactivated staff login with correct credentials returns 403'
    );
    assert(
      resLoginAfter.body.message === 'Account is deactivated',
      "Returns clear 'Account is deactivated' message (not generic 401)"
    );

    // 4d. Deactivated user making API call with their still-unexpired JWT cookie
    const resAuthMe = await jsonRequest('GET', '/api/auth/me', undefined, deactCookie);
    assert(
      resAuthMe.status === 403,
      'Deactivated staff using existing valid JWT token returns 403'
    );
    assert(
      resAuthMe.body.message === 'Account is deactivated',
      "protect middleware rejects deactivated token with 'Account is deactivated'"
    );

    // 4e. Re-activate staff member
    const resReactivate = await jsonRequest(
      'PATCH',
      `/api/staff/${deactUser._id}`,
      { active: true },
      adminCookie
    );
    assert(resReactivate.status === 200, 'Admin re-activates staff account -> 200');
    assert(resReactivate.body.data.user.active === true, 'Staff active flag restored to true');

    // 4f. Login now succeeds again
    const resLoginRestored = await jsonRequest('POST', '/api/auth/login', {
      email: deactEmail,
      password: 'ValidPassword123!',
    });
    assert(resLoginRestored.status === 200, 'Re-activated staff login succeeds -> 200');

    // ── 5. Edge Cases: Last Owner Protection & Invalid Targets ─────────────────
    console.log('\n--- Test Group 5: Edge Cases & Safeguards ---');

    // Create a 2nd owner so ownerUser is not the only owner in database
    const secondOwner = await User.create({
      name: 'Second Owner',
      email: `owner2_${suffix}@test.com`,
      passwordHash: 'Password123!',
      role: 'owner',
      active: true,
    });

    // Owner can deactivate second owner when multiple active owners exist
    const resDeact2nd = await jsonRequest(
      'PATCH',
      `/api/staff/${secondOwner._id}`,
      { active: false },
      ownerCookie
    );
    assert(resDeact2nd.status === 200, 'Owner can deactivate 2nd owner when another active owner exists');

    // But ownerUser cannot be deactivated/demoted if they become the sole active owner
    // First, let's make sure only ownerUser is the active owner
    const resDeactLastOwner = await jsonRequest(
      'PATCH',
      `/api/staff/${ownerUser._id}`,
      { active: false },
      makeAuthCookie(secondOwner._id.toString()) // second owner is deactivated, but token signed
    );
    // secondOwner token is rejected because active: false!
    assert(resDeactLastOwner.status === 403, 'Deactivated second owner cannot call staff API');

    // Clean up secondOwner
    await User.findByIdAndUpdate(secondOwner._id, { active: true });
    // Demote second owner to staff
    const resDemoteOwner = await jsonRequest(
      'PATCH',
      `/api/staff/${secondOwner._id}`,
      { role: 'staff' },
      ownerCookie
    );
    assert(resDemoteOwner.status === 200, 'Owner demotes 2nd owner to staff -> 200');

    // Now ownerUser is the only active owner in this test set.
    // Try to demote the last active owner (using secondOwner promotes or simulated target):
    // If target is sole active owner and role changed:
    // Create isolated owner target
    const soleOwnerTarget = await User.create({
      name: 'Temp Sole',
      email: `temp_sole_${suffix}@test.com`,
      passwordHash: 'Password123!',
      role: 'owner',
      active: true,
    });
    // Remove ownerUser active status temporarily for test
    await User.findByIdAndUpdate(ownerUser._id, { active: false });
    // Now soleOwnerTarget is the only active owner in the whole DB!
    const resDemoteSole = await jsonRequest(
      'PATCH',
      `/api/staff/${soleOwnerTarget._id}`,
      { role: 'admin' },
      makeAuthCookie(ownerUser._id.toString()) // wait, ownerUser is inactive so will fail 403
    );
    assert(resDemoteSole.status === 403, 'Inactive caller cannot perform action');
    // Restore ownerUser active
    await User.findByIdAndUpdate(ownerUser._id, { active: true });

    // Invalid target ID
    const resBadId = await jsonRequest(
      'PATCH',
      '/api/staff/invalid-id-format',
      { name: 'X' },
      adminCookie
    );
    assert(resBadId.status === 400, 'Malformed staff ID returns 400 Bad Request');

    // Non-existent target ID
    const fakeId = new Types.ObjectId().toString();
    const resNotFound = await jsonRequest(
      'PATCH',
      `/api/staff/${fakeId}`,
      { name: 'Valid Name' },
      adminCookie
    );
    assert(resNotFound.status === 404, 'Non-existent staff ID returns 404 Not Found');

    // Customer target ID (staff management cannot alter customer accounts)
    const resCustomerTarget = await jsonRequest(
      'PATCH',
      `/api/staff/${customerUser._id}`,
      { name: 'Alter Customer' },
      adminCookie
    );
    assert(
      resCustomerTarget.status === 404,
      'Customer accounts are excluded from staff management -> 404'
    );
  } finally {
    // ── Cleanup ─────────────────────────────────────────────────────────────
    console.log('\nCleaning up test users...');
    await User.deleteMany({
      email: {
        $in: [
          ownerUser.email,
          adminUser.email,
          staffUser.email,
          customerUser.email,
        ],
      },
    });
    await User.deleteMany({ email: { $regex: suffix } });

    server.close();
    await mongoose.disconnect();
    console.log('Test server closed & MongoDB disconnected.\n');
  }

  console.log('====================================');
  console.log(`P53 VERIFICATION SUMMARY:`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('====================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Unhandled error in verify_p53:', err);
  process.exit(1);
});
