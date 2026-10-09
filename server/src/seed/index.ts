import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { seedDepartments } from './department.seed';
import { seedCategories } from './category.seed';
import { seedProducts } from './product.seed';
import { seedUsers } from './user.seed';
import { seedSuppliers } from './supplier.seed';
import { seedSettings } from './setting.seed';
import { seedCoupons } from './coupon.seed';
import { seedWallets } from './wallet.seed';

dotenv.config();

export const runAllSeeds = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/shop';
  console.log('==================================================');
  console.log('           STARTING DATABASE SEEDING              ');
  console.log('==================================================');
  console.log(`Target database: ${mongoUri}\n`);

  await mongoose.connect(mongoUri);

  console.log('Step 1: Seeding Settings...');
  await seedSettings();
  console.log('✔ Settings Seeding Complete.\n');

  console.log('Step 2: Seeding Departments...');
  await seedDepartments();
  console.log('✔ Departments Seeding Complete.\n');

  console.log('Step 3: Seeding Categories...');
  await seedCategories();
  console.log('✔ Categories Seeding Complete.\n');

  console.log('Step 4: Seeding Users...');
  await seedUsers();
  console.log('✔ Users Seeding Complete.\n');

  console.log('Step 5: Seeding Suppliers...');
  await seedSuppliers();
  console.log('✔ Suppliers Seeding Complete.\n');

  console.log('Step 6: Seeding Wallets & Initial Points...');
  await seedWallets();
  console.log('✔ Wallets Seeding Complete.\n');

  console.log('Step 7: Seeding Coupons...');
  await seedCoupons();
  console.log('✔ Coupons Seeding Complete.\n');

  console.log('Step 8: Seeding Products...');
  await seedProducts();
  console.log('✔ Products Seeding Complete.\n');

  console.log('Step 9: Running Migrations...');
  const { up: runCategoryDepartmentBackfill } = await import('../migrations/2026_category_department_backfill');
  await runCategoryDepartmentBackfill();
  console.log('✔ Migrations Complete.\n');

  console.log('==================================================');
  console.log('         DATABASE SEEDING FINISHED CLEANLY        ');
  console.log('==================================================');
  await mongoose.disconnect();
};

if (require.main === module) {
  runAllSeeds().catch(async (err) => {
    console.error('❌ Database Seeding Failed:', err);
    await mongoose.disconnect();
    process.exit(1);
  });
}
