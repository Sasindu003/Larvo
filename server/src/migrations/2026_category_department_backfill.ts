import { Department } from '../models/Department';
import { Category } from '../models/Category';

export const up = async () => {
  console.log('Running Migration: 2026_category_department_backfill...');

  // 1. Fetch departments
  const departments = await Department.find();
  const deptMap = new Map();
  departments.forEach((d) => deptMap.set(d.slug, d._id));

  // Ensure our required departments exist
  for (const slug of ['men', 'women', 'kids', 'unisex']) {
    if (!deptMap.has(slug)) {
      throw new Error(`Migration aborted: Required department '${slug}' not found in DB.`);
    }
  }

  // 2. Define the mapping logic
  const categoryMapping: Record<string, string> = {
    'mens': 'men',
    'womens': 'women',
    'kids': 'kids',
    'streetwear': 'unisex',
    'formal': 'unisex',
    'casual': 'unisex',
    'sportswear': 'unisex',
    'seasonal-collections': 'unisex',
    'accessories': 'unisex',
  };

  // 3. Idempotency check: are there any categories without a department?
  const allCategories = await Category.find();
  const categoriesMissingDept = allCategories.filter((cat) => !cat.department);

  if (categoriesMissingDept.length === 0) {
    console.log('Migration is idempotent: All categories already have a department assigned.');
    return;
  }

  // 4. Pre-flight check: ensure every category missing a department matches our mapping
  for (const cat of categoriesMissingDept) {
    if (!categoryMapping[cat.slug]) {
      throw new Error(
        `Migration aborted: Category '${cat.slug}' does not match any known department mapping.`
      );
    }
  }

  // 5. Execution: bulk update categories
  const bulkOps = categoriesMissingDept.map((cat) => {
    const targetDeptSlug = categoryMapping[cat.slug];
    const targetDeptId = deptMap.get(targetDeptSlug);
    return {
      updateOne: {
        filter: { _id: cat._id },
        update: { $set: { department: targetDeptId } },
      },
    };
  });

  if (bulkOps.length > 0) {
    const result = await Category.collection.bulkWrite(bulkOps);
    console.log(`Migration Complete: Successfully assigned departments to ${result.modifiedCount} categories.`);
  }
};
