import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Product } from './src/models/Product';
import { Category } from './src/models/Category';
import { inventoryService, LOW_STOCK_THRESHOLD } from './src/services/inventory.service';
import { AppError } from './src/middleware/error.middleware';

dotenv.config();

async function runP31Verification() {
  console.log('====================================================');
  console.log('       RUNNING P31 INVENTORY SERVICE CHECKS         ');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/shop';
  await mongoose.connect(mongoUri);

  try {
    // 1. Check LOW_STOCK_THRESHOLD and getStockStatus
    console.log('TEST 1: getStockStatus() unit logic & named constant...');
    if (LOW_STOCK_THRESHOLD !== 5) {
      throw new Error(`Expected LOW_STOCK_THRESHOLD to be 5, got ${LOW_STOCK_THRESHOLD}`);
    }
    if (inventoryService.getStockStatus(0) !== 'out_of_stock') {
      throw new Error('Expected stock=0 to be out_of_stock');
    }
    if (inventoryService.getStockStatus(-2) !== 'out_of_stock') {
      throw new Error('Expected stock=-2 to be out_of_stock');
    }
    if (inventoryService.getStockStatus(1) !== 'low_stock') {
      throw new Error('Expected stock=1 to be low_stock');
    }
    if (inventoryService.getStockStatus(5) !== 'low_stock') {
      throw new Error('Expected stock=5 to be low_stock');
    }
    if (inventoryService.getStockStatus(6) !== 'in_stock') {
      throw new Error('Expected stock=6 to be in_stock');
    }
    if (inventoryService.getStockStatus(100) !== 'in_stock') {
      throw new Error('Expected stock=100 to be in_stock');
    }
    console.log('  ✔ PASS: getStockStatus behaves accurately against LOW_STOCK_THRESHOLD=5.\n');

    // Get an existing category for dummy products
    let cat = await Category.findOne();
    if (!cat) {
      cat = await Category.create({
        name: 'Test Cat P31',
        slug: 'test-cat-p31-' + Date.now(),
        description: 'Test category for P31',
      });
    }

    // Ensure index is created on Product
    await Product.init();

    // Clean up any existing test products with these test SKUs
    const testSkuDuplicate = `TEST-P31-DUP-${Date.now()}`;
    const testSkuConcurrent = `TEST-P31-CONCUR-${Date.now()}`;

    // 2. Test global SKU uniqueness across different products
    console.log('TEST 2: Global SKU unique constraint across two different products...');
    const prod1 = await Product.create({
      name: 'P31 Test Product 1',
      slug: `p31-test-prod-1-${Date.now()}`,
      description: 'First test product',
      category: cat._id,
      images: ['https://example.com/p1.jpg'],
      basePrice: 50,
      variants: [
        {
          size: 'M',
          color: 'Blue',
          material: 'Cotton',
          sku: testSkuDuplicate,
          stock: 15,
        },
      ],
      status: 'active',
    });

    let duplicateFailed = false;
    let duplicateErrorCode = null;
    let duplicateErrorSku = null;

    try {
      await Product.create({
        name: 'P31 Test Product 2',
        slug: `p31-test-prod-2-${Date.now()}`,
        description: 'Second test product sharing SKU',
        category: cat._id,
        images: ['https://example.com/p2.jpg'],
        basePrice: 60,
        variants: [
          {
            size: 'L',
            color: 'Red',
            material: 'Polyester',
            sku: testSkuDuplicate, // Duplicate SKU!
            stock: 10,
          },
        ],
        status: 'active',
      });
    } catch (err: any) {
      duplicateFailed = true;
      duplicateErrorCode = err.code;
      duplicateErrorSku = err.keyValue?.['variants.sku'];
    }

    if (!duplicateFailed || duplicateErrorCode !== 11000) {
      throw new Error(`Expected second product insert with duplicate SKU to fail with E11000, got: code=${duplicateErrorCode}`);
    }
    console.log(`  ✔ PASS: Second insert with SKU '${testSkuDuplicate}' failed with E11000.\n`);

    // Clean up prod1
    await Product.deleteOne({ _id: prod1._id });

    // 3. Test Concurrent adjustStock(-1) with floor guard
    console.log('TEST 3: 20 concurrent adjustStock(-1) calls against variant with stock=10...');
    const testProduct = await Product.create({
      name: 'P31 Concurrency Test Product',
      slug: `p31-concurrency-${Date.now()}`,
      description: 'Concurrency test product',
      category: cat._id,
      images: ['https://example.com/p3.jpg'],
      basePrice: 80,
      variants: [
        {
          size: 'S',
          color: 'Black',
          material: 'Wool',
          sku: testSkuConcurrent,
          stock: 10,
        },
      ],
      status: 'active',
    });

    const calls = Array.from({ length: 20 }, () =>
      inventoryService.adjustStock(testProduct._id, testSkuConcurrent, -1)
    );

    const results = await Promise.allSettled(calls);

    let successCount = 0;
    let shortfallCount = 0;

    for (const res of results) {
      if (res.status === 'fulfilled') {
        successCount++;
      } else {
        shortfallCount++;
        const error = res.reason;
        if (!(error instanceof AppError) || error.statusCode !== 409) {
          throw new Error(`Expected AppError 409 on shortfall, got: ${error}`);
        }
      }
    }

    console.log(`  Total calls: 20`);
    console.log(`  Successful decrements: ${successCount}`);
    console.log(`  Shortfall / rejected calls: ${shortfallCount}`);

    if (successCount !== 10 || shortfallCount !== 10) {
      throw new Error(`Expected exactly 10 successes and 10 shortfalls, got: ${successCount} successes, ${shortfallCount} shortfalls`);
    }

    // Verify database stock is exactly 0
    const finalProduct = await Product.findById(testProduct._id);
    const finalStock = finalProduct?.variants.find((v) => v.sku === testSkuConcurrent)?.stock;
    console.log(`  Final stock in DB: ${finalStock}`);

    if (finalStock !== 0) {
      throw new Error(`Expected final stock to be exactly 0, got ${finalStock}`);
    }
    console.log('  ✔ PASS: Stock never went negative, concurrency floor guard held perfectly.\n');

    // 4. Test checkAvailability
    console.log('TEST 4: checkAvailability item batch test...');
    // Restock to 5
    await inventoryService.adjustStock(testProduct._id, testSkuConcurrent, 5);

    const checkRes = await inventoryService.checkAvailability([
      { sku: testSkuConcurrent, qty: 3 },  // should be ok (available 5, needed 3)
      { sku: testSkuConcurrent, qty: 10 }, // should fail (available 5, needed 10, shortfall 5)
      { sku: 'NON-EXISTENT-SKU-999', qty: 1 }, // should fail (available 0, shortfall 1)
    ]);

    console.log('  checkAvailability output:', JSON.stringify(checkRes, null, 2));

    if (!checkRes[0].ok || checkRes[0].shortfall !== 0 || checkRes[0].available !== 5) {
      throw new Error('Item 0 should be ok=true, shortfall=0, available=5');
    }
    if (checkRes[1].ok || checkRes[1].shortfall !== 5 || checkRes[1].available !== 5) {
      throw new Error('Item 1 should be ok=false, shortfall=5, available=5');
    }
    if (checkRes[2].ok || checkRes[2].shortfall !== 1 || checkRes[2].available !== 0) {
      throw new Error('Item 2 should be ok=false, shortfall=1, available=0');
    }
    console.log('  ✔ PASS: checkAvailability correctly computes ok and shortfall.\n');

    // Clean up
    await Product.deleteOne({ _id: testProduct._id });

    console.log('====================================================');
    console.log('       🎉 ALL P31 VERIFICATION CHECKS PASSED!        ');
    console.log('====================================================');
  } finally {
    await mongoose.disconnect();
  }
}

runP31Verification().catch((err) => {
  console.error('\n❌ P31 Verification Failed:', err);
  process.exit(1);
});
