import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from './src/models/User';

dotenv.config();

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/shop');
  const hash = await bcrypt.hash('Password123!', 10);

  await User.findOneAndUpdate(
    { email: 'admin@larvo.com' },
    {
      $set: {
        name: 'Admin User',
        email: 'admin@larvo.com',
        role: 'admin',
        passwordHash: hash,
        active: true,
        authProvider: 'local',
      },
    },
    { upsert: true }
  );

  await User.findOneAndUpdate(
    { email: 'staff@larvo.com' },
    {
      $set: {
        name: 'Staff User',
        email: 'staff@larvo.com',
        role: 'staff',
        passwordHash: hash,
        active: true,
        authProvider: 'local',
      },
    },
    { upsert: true }
  );

  console.log('Successfully seeded admin@larvo.com and staff@larvo.com with Password123!');
  await mongoose.disconnect();
}

seed().catch(console.error);
