import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { Coupon } from './src/models/Coupon';
import { User } from './src/models/User';
import { Order } from './src/models/Order';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/shop';
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';
const BASE_URL = 'http://localhost:5000/api';

async function verifyP41() {
  console.log('--- STARTING P41 VERIFICATION ---');
  let passCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, message: string) {
    totalCount++;
    if (condition) {
      console.log(`[PASS] ${message}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${message}`);
    }
  }

  await mongoose.connect(MONGO_URI);

  try {
    // 1. Find or create a test customer
    let user = await User.findOne({ email: 'customer@demo.com' });
    if (!user) {
      user = await User.create({
        name: 'Demo Customer',
        email: 'customer@demo.com',
        password: 'password123',
        role: 'customer',
      });
    }

    const token = jwt.sign({ sub: user._id.toString(), role: user.role }, JWT_SECRET, { expiresIn: '1d' });

    // 2. Seed test coupons
    await Coupon.deleteMany({ code: { $in: ['P41SAVE10', 'P41FLAT200', 'P41EXPIRED', 'P41MIN2000', 'P41USAGE'] } });
    await Order.deleteMany({ couponCode: 'P41USAGE' });

    const now = new Date();
    const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    await Coupon.create([
      {
        code: 'P41SAVE10',
        discountType: 'percentage',
        discountValue: 10,
        maxDiscountAmount: 300,
        minOrderAmount: 1000,
        validFrom: pastDate,
        validUntil: futureDate,
        active: true,
      },
      {
        code: 'P41FLAT200',
        discountType: 'fixed',
        discountValue: 200,
        minOrderAmount: 500,
        validFrom: pastDate,
        validUntil: futureDate,
        active: true,
      },
      {
        code: 'P41EXPIRED',
        discountType: 'percentage',
        discountValue: 20,
        minOrderAmount: 100,
        validFrom: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        validUntil: pastDate,
        active: true,
      },
      {
        code: 'P41MIN2000',
        discountType: 'percentage',
        discountValue: 15,
        minOrderAmount: 2000,
        validFrom: pastDate,
        validUntil: futureDate,
        active: true,
      },
      {
        code: 'P41USAGE',
        discountType: 'fixed',
        discountValue: 100,
        usageLimit: 1,
        validFrom: pastDate,
        validUntil: futureDate,
        active: true,
      },
    ]);

    // Create an order that used P41USAGE to test limit
    await Order.create({
      user: user._id,
      items: [
        {
          product: new mongoose.Types.ObjectId(),
          name: 'Test Product',
          price: 1500,
          unitPrice: 1500,
          color: 'Blue',
          size: 'M',
          variantSku: 'SKU-P41-TEST',
          image: 'https://example.com/test.jpg',
          quantity: 1,
        },
      ],
      shippingAddress: {
        line1: '123 Test St',
        city: 'Dhaka',
        province: 'Dhaka Division',
        postalCode: '1212',
        country: 'Bangladesh',
      },
      total: 1460,
      subtotal: 1500,
      shippingFee: 60,
      couponCode: 'P41USAGE',
      couponDiscount: 100,
      status: 'processing',
    });

    async function callValidate(code: string, subtotal: number, authToken: string = token) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Cookie'] = `slt=${authToken}`;
      }
      const res = await fetch(`${BASE_URL}/coupons/validate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ code, subtotal }),
      });
      return { status: res.status, body: await res.json() };
    }

    // Test 1: Percentage coupon calculation (10% of 2000 = 200)
    const test1 = await callValidate('P41SAVE10', 2000);
    assert(test1.status === 200, 'Test 1: HTTP 200 on valid coupon');
    assert(test1.body.success === true, 'Test 1: Success flag is true');
    assert(test1.body.data.valid === true, 'Test 1: Coupon valid flag is true');
    assert(test1.body.data.discountAmount === 200, `Test 1: Expected discount 200, got ${test1.body.data.discountAmount}`);
    assert(test1.body.data.coupon?.code === 'P41SAVE10', 'Test 1: Returns coupon code');

    // Test 2: Percentage coupon capped by maxDiscountAmount (10% of 5000 = 500, capped to 300)
    const test2 = await callValidate('P41SAVE10', 5000);
    assert(test2.status === 200, 'Test 2: HTTP 200 on capped coupon');
    assert(test2.body.data.valid === true, 'Test 2: Capped coupon is valid');
    assert(test2.body.data.discountAmount === 300, `Test 2: Expected capped discount 300, got ${test2.body.data.discountAmount}`);

    // Test 3: Fixed discount coupon
    const test3 = await callValidate('P41FLAT200', 1200);
    assert(test3.status === 200, 'Test 3: HTTP 200 on fixed coupon');
    assert(test3.body.data.valid === true, 'Test 3: Fixed coupon is valid');
    assert(test3.body.data.discountAmount === 200, `Test 3: Expected discount 200, got ${test3.body.data.discountAmount}`);

    // Test 4: Fixed discount coupon with subtotal < minOrderAmount (500)
    const test4 = await callValidate('P41FLAT200', 400);
    assert(test4.status === 200, 'Test 4: HTTP 200 returning valid=false on below minOrderAmount');
    assert(test4.body.data.valid === false, 'Test 4: Ineligible coupon has valid=false');
    assert(typeof test4.body.data.message === 'string' && test4.body.data.message.toLowerCase().includes('minimum'), `Test 4: Specific rejection message received: "${test4.body.data.message}"`);

    // Test 5: Expired coupon rejection
    const test5 = await callValidate('P41EXPIRED', 2000);
    assert(test5.status === 200, 'Test 5: HTTP 200 on expired coupon validation check');
    assert(test5.body.data.valid === false, 'Test 5: Expired coupon has valid=false');
    assert(typeof test5.body.data.message === 'string' && test5.body.data.message.toLowerCase().includes('expired'), `Test 5: Rejection mentions expired: "${test5.body.data.message}"`);

    // Test 6: Min order requirement violation on percentage coupon
    const test6 = await callValidate('P41MIN2000', 1500);
    assert(test6.body.data.valid === false, 'Test 6: Order below 2000 is invalid');
    assert(typeof test6.body.data.message === 'string' && test6.body.data.message.toLowerCase().includes('minimum'), `Test 6: Mentions minimum order requirement: "${test6.body.data.message}"`);

    // Test 7: Usage limit reached coupon rejection
    const test7 = await callValidate('P41USAGE', 1000);
    assert(test7.body.data.valid === false, 'Test 7: Exhausted usage coupon has valid=false');
    assert(typeof test7.body.data.message === 'string' && test7.body.data.message.toLowerCase().includes('usage limit'), `Test 7: Mentions usage limit: "${test7.body.data.message}"`);

    // Test 8: Non-existent coupon code
    const test8 = await callValidate('DOESNOTEXIST999', 1000);
    assert(test8.body.data.valid === false, 'Test 8: Non-existent code has valid=false');
    assert(typeof test8.body.data.message === 'string' && test8.body.data.message.toLowerCase().includes('not found'), `Test 8: Mentions not found: "${test8.body.data.message}"`);

    // Test 9: Case-insensitivity normalization in coupon service / endpoint
    const test9 = await callValidate('p41save10', 2000);
    assert(test9.body.data.valid === true, 'Test 9: Lowercase code correctly recognized');
    assert(test9.body.data.discountAmount === 200, 'Test 9: Lowercase code calculates correct discount');

    // Test 10: Unauthorized request rejected
    const test10 = await callValidate('P41SAVE10', 2000, '');
    assert(test10.status === 401, 'Test 10: Unauthenticated request rejected with 401');

    console.log(`\n--- VERIFICATION COMPLETE: ${passCount}/${totalCount} tests passed ---`);
  } catch (error) {
    console.error('Verification error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

verifyP41();
