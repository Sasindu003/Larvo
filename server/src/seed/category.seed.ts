import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Category } from '../models/Category';

dotenv.config();

export const CATEGORIES_SEED_DATA = [
  {
    name: "Men's",
    slug: 'mens',
    image: 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?auto=format&fit=crop&w=800&q=80',
    parent: null,
  },
  {
    name: "Women's",
    slug: 'womens',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
    parent: null,
  },
  {
    name: 'Kids',
    slug: 'kids',
    image: 'https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=800&q=80',
    parent: null,
  },
  {
    name: 'Streetwear',
    slug: 'streetwear',
    image: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=800&q=80',
    parent: null,
  },
  {
    name: 'Formal',
    slug: 'formal',
    image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=800&q=80',
    parent: null,
  },
  {
    name: 'Casual',
    slug: 'casual',
    image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
    parent: null,
  },
  {
    name: 'Sportswear',
    slug: 'sportswear',
    image: 'https://images.unsplash.com/photo-1518459031867-a89b944bffe4?auto=format&fit=crop&w=800&q=80',
    parent: null,
  },
  {
    name: 'Seasonal Collections',
    slug: 'seasonal-collections',
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80',
    parent: null,
  },
  {
    name: 'Accessories',
    slug: 'accessories',
    image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
    parent: null,
  },
];

export const seedCategories = async (): Promise<void> => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/shop';
  console.log(`Connecting to MongoDB at ${mongoUri}...`);

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  console.log(`Seeding ${CATEGORIES_SEED_DATA.length} categories (idempotent upsert)...`);

  const bulkOps = CATEGORIES_SEED_DATA.map((cat) => ({
    updateOne: {
      filter: { slug: cat.slug },
      update: {
        $set: {
          name: cat.name,
          slug: cat.slug,
          image: cat.image,
          parent: cat.parent,
        },
      },
      upsert: true,
    },
  }));

  const result = await Category.bulkWrite(bulkOps);
  console.log(
    `Categories seed completed successfully. Matched: ${result.matchedCount}, Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}`
  );

  const allCategories = await Category.find().select('name slug image');
  console.log(`Total categories in database: ${allCategories.length}`);
};

if (require.main === module) {
  seedCategories()
    .then(async () => {
      console.log('Category seed finished.');
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Error seeding categories:', err);
      await mongoose.disconnect();
      process.exit(1);
    });
}
