import { Department } from '../models/Department';

export const seedDepartments = async () => {
  const departmentsData = [
    { name: 'Men', slug: 'men', image: '/images/departments/men.jpg' },
    { name: 'Women', slug: 'women', image: '/images/departments/women.jpg' },
    { name: 'Kids', slug: 'kids', image: '/images/departments/kids.jpg' },
    { name: 'Unisex', slug: 'unisex', image: '/images/departments/unisex.jpg' },
  ];

  for (const dept of departmentsData) {
    await Department.updateOne(
      { slug: dept.slug },
      { $setOnInsert: dept },
      { upsert: true }
    );
  }
};
