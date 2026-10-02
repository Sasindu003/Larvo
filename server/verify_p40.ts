import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './src/models/User';

dotenv.config();

const API_PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/shop';

function request(
  method: string,
  path: string,
  body?: any,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
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
            resolve({
              status: res.statusCode || 500,
              body: data ? JSON.parse(data) : null,
              headers: res.headers,
            });
          } catch (e) {
            resolve({ status: res.statusCode || 500, body: data, headers: res.headers });
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function extractCookie(headers: http.IncomingHttpHeaders): string {
  const setCookie = headers['set-cookie'];
  if (!setCookie || setCookie.length === 0) return '';
  return setCookie[0].split(';')[0];
}

async function run() {
  console.log('====================================================');
  console.log('   RUNNING P40 CHECKOUT STEP 2 ADDRESS TEST SUITE   ');
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
  console.log('✔ Connected directly to MongoDB for verification.\n');

  try {
    const email = `p40_tester_${Date.now()}@example.com`;
    const password = 'Password123!';

    // ── TEST 1: Register and login new customer with 0 addresses ──
    console.log('--- TEST 1: New customer starts with 0 addresses ---');
    const regRes = await request('POST', '/api/auth/register', {
      name: 'P40 Address Tester',
      email,
      password,
    });
    assert(regRes.status === 201, 'Registration returns 201');

    const loginRes = await request('POST', '/api/auth/login', {
      email,
      password,
    });
    assert(loginRes.status === 200, 'Login returns 200');
    const authCookie = extractCookie(loginRes.headers);
    assert(!!authCookie, 'Received authentication session cookie');

    const meRes = await request('GET', '/api/auth/me', undefined, {
      Cookie: authCookie,
    });
    assert(meRes.status === 200, 'GET /api/auth/me returns 200');
    const userAddresses = meRes.body.data.user.addresses || [];
    assert(Array.isArray(userAddresses), 'User has addresses array');
    assert(userAddresses.length === 0, 'New customer has exactly 0 addresses');

    // ── TEST 2: Add first address (must auto-become default) ──
    console.log('\n--- TEST 2: Add first delivery address (auto-default) ---');
    const addr1Payload = {
      label: 'Home',
      line1: 'Road 11, House 45',
      line2: 'Flat 4B',
      city: 'Dhaka',
      province: 'Dhaka Division',
      postalCode: '1213',
      country: 'Bangladesh',
      phone: '+880 1711 000000',
      isDefault: false, // Even if requested false, first address must become default
    };

    const addRes1 = await request('POST', '/api/users/me/addresses', addr1Payload, {
      Cookie: authCookie,
    });
    assert(addRes1.status === 201, 'POST /api/users/me/addresses returns 201');
    assert(addRes1.body.success === true, 'Response success is true');
    assert(Array.isArray(addRes1.body.data), 'Returns updated addresses array');
    assert(addRes1.body.data.length === 1, 'Addresses length is now 1');
    const addr1 = addRes1.body.data[0];
    assert(addr1.isDefault === true, 'First address automatically assigned isDefault: true');
    assert(addr1.line1 === addr1Payload.line1, 'Line1 stored correctly');
    assert(addr1.city === addr1Payload.city, 'City stored correctly');
    assert(addr1.postalCode === addr1Payload.postalCode, 'PostalCode stored correctly');

    // ── TEST 3: Add second address (non-default) ──
    console.log('\n--- TEST 3: Add second address (non-default) ---');
    const addr2Payload = {
      label: 'Office',
      line1: 'Gulshan Avenue, Plot 10',
      line2: 'Level 8',
      city: 'Dhaka',
      province: 'Dhaka Division',
      postalCode: '1212',
      country: 'Bangladesh',
      phone: '+880 1722 000000',
      isDefault: false,
    };

    const addRes2 = await request('POST', '/api/users/me/addresses', addr2Payload, {
      Cookie: authCookie,
    });
    assert(addRes2.status === 201, 'Returns 201 status for second address');
    assert(addRes2.body.data.length === 2, 'Addresses length is now 2');
    const savedAddr1 = addRes2.body.data.find((a: any) => a._id === addr1._id);
    const savedAddr2 = addRes2.body.data.find((a: any) => a.label === 'Office');
    assert(savedAddr1.isDefault === true, 'First address remains default');
    assert(savedAddr2 && savedAddr2.isDefault === false, 'Second address is non-default');

    // ── TEST 4: Switch default address via PATCH ──
    console.log('\n--- TEST 4: Set second address as default ---');
    const patchRes = await request(
      'PATCH',
      `/api/users/me/addresses/${savedAddr2._id}`,
      { isDefault: true },
      { Cookie: authCookie }
    );
    assert(patchRes.status === 200, 'PATCH returns 200 status');
    const patchedAddr1 = patchRes.body.data.find((a: any) => a._id === addr1._id);
    const patchedAddr2 = patchRes.body.data.find((a: any) => a._id === savedAddr2._id);
    assert(patchedAddr2.isDefault === true, 'Second address is now default');
    assert(patchedAddr1.isDefault === false, 'First address is no longer default');

    // ── TEST 5: Verify Address Snapshot compliance with Order schema ──
    console.log('\n--- TEST 5: Snapshot Compatibility with Order Model ---');
    const userDoc = await User.findOne({ email });
    const chosenAddress = userDoc?.addresses.find((a) => a.isDefault);
    assert(!!chosenAddress, 'User document has default address in MongoDB');
    assert(typeof chosenAddress?.line1 === 'string', 'Snapshot line1 is valid');
    assert(typeof chosenAddress?.city === 'string', 'Snapshot city is valid');
    assert(typeof chosenAddress?.province === 'string', 'Snapshot province is valid');
    assert(typeof chosenAddress?.postalCode === 'string', 'Snapshot postalCode is valid');
    assert(typeof chosenAddress?.country === 'string', 'Snapshot country is valid');

    // Cleanup test user
    await User.deleteOne({ email });
    console.log('\n✔ Test user cleaned up from database.');

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
