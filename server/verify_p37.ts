import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Coupon } from './src/models/Coupon';
import { Order } from './src/models/Order';
import { User } from './src/models/User';
import { couponService, computeDiscount, validateCoupon } from './src/services/coupon.service';

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
  console.log('       RUNNING P37 COUPON VALIDATION VERIFICATION   ');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/shop';
  await mongoose.connect(mongoUri);
  console.log('✔ Connected directly to MongoDB for test fixtures and assertions.\n');

  try {
    // 1. Unauthenticated request to /api/coupons/validate (must reject with 401)
    console.log('TEST 1: Unauthenticated request to /api/coupons/validate (expect 401)...');
    const r1 = await request('POST', '/api/coupons/validate', { code: 'ANY', subtotal: 100 });
    if (r1.status !== 401) {
      throw new Error(`Expected status 401, got ${r1.status}: ${JSON.stringify(r1.body)}`);
    }
    console.log('✔ Rejected unauthenticated request with 401.\n');

    // 2. Register & login test user
    console.log('TEST 2: Register & login customer user...');
    const email = `p37_cust_${Date.now()}@example.com`;
    const password = 'Password123!';
    await request('POST', '/api/auth/register', { name: 'P37 Tester', email, password });
    const loginRes = await request('POST', '/api/auth/login', { email, password });
    const cookie = getCookieHeader(loginRes);
    const userDoc = await User.findOne({ email });
    if (!userDoc) throw new Error('Failed to find registered test user in DB');
    const userId = userDoc._id.toString();
    console.log(`✔ Logged in customer, userId: ${userId}\n`);

    // 3. Validation error on bad payloads (expect 422)
    console.log('TEST 3: Schema validation on invalid body (expect 422)...');
    const bad1 = await request('POST', '/api/coupons/validate', { code: '' }, cookie);
    if (bad1.status !== 422) throw new Error(`Expected 422 for missing subtotal, got ${bad1.status}`);
    const bad2 = await request('POST', '/api/coupons/validate', { code: 'TEST', subtotal: -10 }, cookie);
    if (bad2.status !== 422) throw new Error(`Expected 422 for negative subtotal, got ${bad2.status}`);
    console.log('✔ Correctly returned 422 for invalid payloads.\n');

    // 4. Non-existent coupon code
    console.log('TEST 4: Non-existent coupon code...');
    const rNonExistent = await request('POST', '/api/coupons/validate', { code: 'DOESNOTEXIST99', subtotal: 500 }, cookie);
    if (rNonExistent.status !== 200 || rNonExistent.body.data.valid !== false || rNonExistent.body.data.message !== 'Coupon code not found') {
      throw new Error(`Unexpected response for non-existent coupon: ${JSON.stringify(rNonExistent.body)}`);
    }
    console.log('✔ Correctly handled non-existent coupon.\n');

    // Setup test coupons in DB
    const prefix = `P37_${Date.now().toString().slice(-5)}`;
    const now = new Date();

    // Coupon: Inactive
    const inactiveCode = `${prefix}_INACTIVE`;
    await Coupon.create({
      code: inactiveCode,
      discountType: 'percentage',
      discountValue: 15,
      validFrom: new Date(now.getTime() - 86400000),
      validUntil: new Date(now.getTime() + 86400000),
      active: false,
    });

    // Coupon: Future
    const futureCode = `${prefix}_FUTURE`;
    await Coupon.create({
      code: futureCode,
      discountType: 'percentage',
      discountValue: 10,
      validFrom: new Date(now.getTime() + 86400000),
      validUntil: new Date(now.getTime() + 172800000),
      active: true,
    });

    // Coupon: Expired
    const expiredCode = `${prefix}_EXPIRED`;
    await Coupon.create({
      code: expiredCode,
      discountType: 'percentage',
      discountValue: 10,
      validFrom: new Date(now.getTime() - 172800000),
      validUntil: new Date(now.getTime() - 86400000),
      active: true,
    });

    // Coupon: Min Order
    const minOrderCode = `${prefix}_MINORDER`;
    await Coupon.create({
      code: minOrderCode,
      discountType: 'percentage',
      discountValue: 20,
      minOrderAmount: 1500,
      validFrom: new Date(now.getTime() - 86400000),
      validUntil: new Date(now.getTime() + 86400000),
      active: true,
    });

    // Coupon: Global Usage Limit
    const globalLimitCode = `${prefix}_GLIMIT`;
    await Coupon.create({
      code: globalLimitCode,
      discountType: 'fixed',
      discountValue: 100,
      usageLimit: 2,
      validFrom: new Date(now.getTime() - 86400000),
      validUntil: new Date(now.getTime() + 86400000),
      active: true,
    });

    // Coupon: Per Customer Limit
    const perCustCode = `${prefix}_PERCUST`;
    await Coupon.create({
      code: perCustCode,
      discountType: 'fixed',
      discountValue: 100,
      perCustomerLimit: 1,
      validFrom: new Date(now.getTime() - 86400000),
      validUntil: new Date(now.getTime() + 86400000),
      active: true,
    });

    // Coupon: Valid Percentage with Max Discount Clamp
    const percentClampCode = `${prefix}_PMAX`;
    await Coupon.create({
      code: percentClampCode,
      discountType: 'percentage',
      discountValue: 25, // 25% of 2000 is 500, clamped to 300
      maxDiscountAmount: 300,
      minOrderAmount: 500,
      validFrom: new Date(now.getTime() - 86400000),
      validUntil: new Date(now.getTime() + 86400000),
      active: true,
    });

    // Coupon: Fixed Discount exceeding subtotal
    const fixedCode = `${prefix}_FIXED`;
    await Coupon.create({
      code: fixedCode,
      discountType: 'fixed',
      discountValue: 400,
      validFrom: new Date(now.getTime() - 86400000),
      validUntil: new Date(now.getTime() + 86400000),
      active: true,
    });

    // 5. Inactive test
    console.log('TEST 5: Inactive coupon check...');
    const rInactive = await request('POST', '/api/coupons/validate', { code: inactiveCode, subtotal: 500 }, cookie);
    if (!rInactive.body.data || rInactive.body.data.valid !== false || rInactive.body.data.message !== 'This coupon is inactive') {
      throw new Error(`Inactive check failed: ${JSON.stringify(rInactive.body)}`);
    }
    console.log('✔ Correctly identified inactive coupon.\n');

    // 6. Future active test
    console.log('TEST 6: Not yet active coupon check...');
    const rFuture = await request('POST', '/api/coupons/validate', { code: futureCode, subtotal: 500 }, cookie);
    if (!rFuture.body.data || rFuture.body.data.valid !== false || rFuture.body.data.message !== 'This coupon is not yet active') {
      throw new Error(`Future check failed: ${JSON.stringify(rFuture.body)}`);
    }
    console.log('✔ Correctly identified not yet active coupon.\n');

    // 7. Expired test
    console.log('TEST 7: Expired coupon check...');
    const rExpired = await request('POST', '/api/coupons/validate', { code: expiredCode, subtotal: 500 }, cookie);
    if (!rExpired.body.data || rExpired.body.data.valid !== false || rExpired.body.data.message !== 'This coupon has expired') {
      throw new Error(`Expired check failed: ${JSON.stringify(rExpired.body)}`);
    }
    console.log('✔ Correctly identified expired coupon.\n');

    // 8. Min order amount test
    console.log('TEST 8: Min order amount check (subtotal 1000 < min 1500)...');
    const rMinOrderFail = await request('POST', '/api/coupons/validate', { code: minOrderCode, subtotal: 1000 }, cookie);
    if (!rMinOrderFail.body.data || rMinOrderFail.body.data.valid !== false || !rMinOrderFail.body.data.message.includes('1500')) {
      throw new Error(`Min order check failed: ${JSON.stringify(rMinOrderFail.body)}`);
    }
    console.log('✔ Correctly rejected when subtotal < minOrderAmount.\n');

    // 9. Global usage limit test
    console.log('TEST 9: Global usage limit test...');
    // Create 2 confirmed orders with globalLimitCode
    const sampleAddress = {
      line1: '123 Test St',
      city: 'Dhaka',
      province: 'Dhaka',
      postalCode: '1205',
      country: 'Bangladesh',
    };
    const sampleItem = {
      product: new mongoose.Types.ObjectId(),
      name: 'Test Shirt',
      image: 'sample.png',
      variantSku: 'TST-01',
      size: 'M',
      color: 'Blue',
      unitPrice: 500,
      quantity: 1,
    };

    await Order.create([
      {
        user: new mongoose.Types.ObjectId(),
        items: [sampleItem],
        shippingAddress: sampleAddress,
        couponCode: globalLimitCode,
        discountAmount: 100,
        subtotal: 500,
        shippingFee: 50,
        total: 450,
        status: 'confirmed',
      },
      {
        user: new mongoose.Types.ObjectId(),
        items: [sampleItem],
        shippingAddress: sampleAddress,
        couponCode: globalLimitCode,
        discountAmount: 100,
        subtotal: 500,
        shippingFee: 50,
        total: 450,
        status: 'delivered',
      },
      // Also a cancelled one to ensure cancelled orders don't count
      {
        user: new mongoose.Types.ObjectId(),
        items: [sampleItem],
        shippingAddress: sampleAddress,
        couponCode: globalLimitCode,
        discountAmount: 100,
        subtotal: 500,
        shippingFee: 50,
        total: 450,
        status: 'cancelled',
      },
    ]);

    const rGLimit = await request('POST', '/api/coupons/validate', { code: globalLimitCode, subtotal: 500 }, cookie);
    if (!rGLimit.body.data || rGLimit.body.data.valid !== false || rGLimit.body.data.message !== 'This coupon has reached its maximum usage limit') {
      throw new Error(`Global limit check failed: ${JSON.stringify(rGLimit.body)}`);
    }
    console.log('✔ Correctly rejected when global usageLimit reached (and ignored cancelled order).\n');

    // 10. Per-customer limit test
    console.log('TEST 10: Per-customer limit test...');
    await Order.create({
      user: userDoc._id,
      items: [sampleItem],
      shippingAddress: sampleAddress,
      couponCode: perCustCode,
      discountAmount: 100,
      subtotal: 500,
      shippingFee: 50,
      total: 450,
      status: 'confirmed',
    });

    const rPerCust = await request('POST', '/api/coupons/validate', { code: perCustCode, subtotal: 500 }, cookie);
    if (!rPerCust.body.data || rPerCust.body.data.valid !== false || rPerCust.body.data.message !== 'You have already used this coupon the maximum number of times') {
      throw new Error(`Per-customer limit check failed: ${JSON.stringify(rPerCust.body)}`);
    }
    console.log('✔ Correctly rejected when user has reached perCustomerLimit.\n');

    // 11. Valid percentage coupon with max discount clamping
    console.log('TEST 11: Valid percentage coupon with maxDiscountAmount clamp (25% of 2000 = 500, clamped to 300)...');
    const rClamp = await request('POST', '/api/coupons/validate', { code: percentClampCode, subtotal: 2000 }, cookie);
    if (!rClamp.body.data || rClamp.body.data.valid !== true || rClamp.body.data.discountAmount !== 300) {
      throw new Error(`Clamped discount check failed: ${JSON.stringify(rClamp.body)}`);
    }
    console.log('✔ Correctly applied percentage coupon clamped to maxDiscountAmount (300).\n');

    // 12. Valid fixed discount exceeding subtotal (never negative total)
    console.log('TEST 12: Fixed discount 400 with subtotal 250 (clamped to 250)...');
    const rFixed = await request('POST', '/api/coupons/validate', { code: fixedCode, subtotal: 250 }, cookie);
    if (!rFixed.body.data || rFixed.body.data.valid !== true || rFixed.body.data.discountAmount !== 250) {
      throw new Error(`Fixed discount subtotal clamp check failed: ${JSON.stringify(rFixed.body)}`);
    }
    console.log('✔ Fixed discount correctly capped at subtotal (250).\n');

    // 13. Case-insensitivity and whitespace trimming
    console.log('TEST 13: Case-insensitive and whitespace trimming on code input...');
    const rCase = await request('POST', '/api/coupons/validate', { code: `  ${percentClampCode.toLowerCase()}  `, subtotal: 1000 }, cookie);
    // 25% of 1000 = 250 <= 300 max
    if (!rCase.body.data || rCase.body.data.valid !== true || rCase.body.data.discountAmount !== 250) {
      throw new Error(`Case-insensitivity check failed: ${JSON.stringify(rCase.body)}`);
    }
    console.log('✔ Case-insensitivity and trimming verified (discount 250).\n');

    // 14. Unit test computeDiscount & validateCoupon service functions directly
    console.log('TEST 14: Direct unit testing of computeDiscount and validateCoupon exports...');
    const directResult = await validateCoupon(percentClampCode, userId, 1000);
    if (!directResult.valid || directResult.discountAmount !== 250) {
      throw new Error(`Direct validateCoupon call failed: ${JSON.stringify(directResult)}`);
    }

    const testCoupon = {
      discountType: 'percentage' as const,
      discountValue: 50,
      maxDiscountAmount: 100,
    } as any;
    const testDiscount = computeDiscount(testCoupon, 500);
    if (testDiscount !== 100) {
      throw new Error(`Direct computeDiscount expected 100, got ${testDiscount}`);
    }
    console.log('✔ Direct service function invocations passed.\n');

    // Cleanup test data
    await Coupon.deleteMany({ code: new RegExp(`^${prefix}`) });
    await Order.deleteMany({ couponCode: new RegExp(`^${prefix}`) });
    await User.deleteOne({ _id: userDoc._id });
    console.log('✔ Cleaned up test database records.\n');

    console.log('====================================================');
    console.log('   ALL P37 COUPON VALIDATION TESTS PASSED (14/14)   ');
    console.log('====================================================');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
