/**
 * P09 Logic Check — validates Product schema constraints:
 * 1. Inserts one product with two variants
 * 2. Confirms negative stock is rejected
 * 3. Confirms invalid size enum is rejected
 * 4. Lists indexes including text + compound
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { Category } from '../models/Category';

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/shop');
  console.log('Connected.\n');

  // Resolve a real category _id
  const category = await Category.findOne({ slug: 'formal' });
  if (!category) throw new Error('Seed categories first: npm run seed:categories');

  // ─── 1. Insert a valid product with two variants ─────────────────────────
  await Product.deleteOne({ slug: 'test-blazer' });

  const valid = await Product.create({
    name: 'Test Blazer',
    slug: 'test-blazer',
    description: 'A slim-fit double-button blazer for formal occasions.',
    category: category._id,
    images: ['https://via.placeholder.com/800'],
    basePrice: 249,
    discountPrice: 199,
    status: 'active',
    variants: [
      { size: 'M', color: 'Charcoal', material: 'Wool Blend', sku: 'BLZ-CHR-M', stock: 10 },
      { size: 'L', color: 'Navy',     material: 'Wool Blend', sku: 'BLZ-NVY-L', stock:  5 },
    ],
  });
  console.log('✅ Valid product inserted. inStock:', valid.inStock, '  variants:', valid.variants.length);

  // ─── 2. Reject negative stock ─────────────────────────────────────────────
  try {
    await Product.create({
      name: 'Bad Stock Product',
      slug: 'bad-stock-product',
      description: 'Testing negative stock.',
      category: category._id,
      images: ['https://via.placeholder.com/800'],
      basePrice: 99,
      status: 'active',
      variants: [{ size: 'S', color: 'Black', material: 'Cotton', sku: 'BAD-S', stock: -1 }],
    });
    console.error('❌ SHOULD HAVE FAILED: negative stock was accepted');
  } catch (err: any) {
    console.log('✅ Negative stock correctly rejected:', err.message.split('\n')[0]);
  }

  // ─── 3. Reject invalid size enum ─────────────────────────────────────────
  try {
    await Product.create({
      name: 'Bad Size Product',
      slug: 'bad-size-product',
      description: 'Testing invalid size.',
      category: category._id,
      images: ['https://via.placeholder.com/800'],
      basePrice: 99,
      status: 'active',
      variants: [{ size: 'XXL' as any, color: 'Black', material: 'Cotton', sku: 'BAD-XXL', stock: 5 }],
    });
    console.error('❌ SHOULD HAVE FAILED: invalid size enum was accepted');
  } catch (err: any) {
    console.log('✅ Invalid size enum correctly rejected:', err.message.split('\n')[0]);
  }

  // ─── 4. Show indexes ──────────────────────────────────────────────────────
  const indexes = await mongoose.connection.db!.collection('products').indexes();
  console.log('\nIndexes on products collection:');
  indexes.forEach((idx) => {
    console.log('  ', JSON.stringify(idx.key), '—', idx.name);
  });

  // Cleanup
  await Product.deleteOne({ slug: 'test-blazer' });

  await mongoose.disconnect();
  console.log('\nDone.');
};

run().catch((err) => {
  console.error(err);
  mongoose.disconnect();
  process.exit(1);
});
