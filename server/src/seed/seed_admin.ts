import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function seedAdmin() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/shop';
  await mongoose.connect(mongoUri);
  const hash = await bcrypt.hash('Password123!', 10);
  await mongoose.connection.collection('users').updateOne(
    { email: 'admin@larvo.com' },
    {
      $set: {
        name: 'Larvo Admin',
        email: 'admin@larvo.com',
        passwordHash: hash,
        password: hash,
        role: 'admin',
        active: true,
        emailVerified: true,
      },
    },
    { upsert: true }
  );
  console.log('Seeded admin: admin@larvo.com / Password123!');
  await mongoose.disconnect();
}

seedAdmin().catch(console.error);
