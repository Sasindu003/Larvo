import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { seedDepartments } from './department.seed';
import { seedCategories } from './category.seed';
import { seedProducts } from './product.seed';

dotenv.config();

const runAllSeeds = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/shop';
  console.log('==================================================');
  console.log('           STARTING DATABASE SEEDING              ');
  console.log('==================================================');
  console.log(`Target database: ${mongoUri}\n`);

  await mongoose.connect(mongoUri);

  console.log('Step 1: Seeding Departments...');
  await seedDepartments();
  console.log('✔ Departments Seeding Complete.\n');

  console.log('Step 2: Seeding Categories...');
  await seedCategories();
  console.log('✔ Categories Seeding Complete.\n');

  console.log('Step 3: Seeding Products...');
  await seedProducts();
  console.log('✔ Products Seeding Complete.\n');

  console.log('Step 4: Running Migrations...');
  const { up: runCategoryDepartmentBackfill } = await import('../migrations/2026_category_department_backfill');
  await runCategoryDepartmentBackfill();
  console.log('✔ Migrations Complete.\n');

  console.log('==================================================');
  console.log('         DATABASE SEEDING FINISHED CLEANLY        ');
  console.log('==================================================');
  await mongoose.disconnect();
};

runAllSeeds().catch(async (err) => {
  console.error('❌ Database Seeding Failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
