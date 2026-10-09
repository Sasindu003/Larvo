import bcrypt from 'bcryptjs';
import { User, IUser } from '../models/User';

export const SEED_USERS = [
  {
    name: 'Larvo Owner',
    email: 'owner@larvo.com',
    role: 'owner',
    active: true,
    authProvider: 'local',
    addresses: [
      {
        label: 'Head Office',
        line1: '45 Galle Face Terrace',
        line2: 'Colombo 03',
        city: 'Colombo',
        province: 'Western Province',
        postalCode: '00300',
        country: 'Sri Lanka',
        phone: '0112345678',
        isDefault: true,
      },
    ],
  },
  {
    name: 'Larvo Admin',
    email: 'admin@larvo.com',
    role: 'admin',
    active: true,
    authProvider: 'local',
    addresses: [
      {
        label: 'Office',
        line1: '12 Duplication Road',
        line2: 'Colombo 04',
        city: 'Colombo',
        province: 'Western Province',
        postalCode: '00400',
        country: 'Sri Lanka',
        phone: '0112555666',
        isDefault: true,
      },
    ],
  },
  {
    name: 'Larvo Staff',
    email: 'staff@larvo.com',
    role: 'staff',
    active: true,
    authProvider: 'local',
    addresses: [
      {
        label: 'Home',
        line1: '88 High Level Road',
        city: 'Nugegoda',
        province: 'Western Province',
        postalCode: '10250',
        country: 'Sri Lanka',
        phone: '0772345678',
        isDefault: true,
      },
    ],
  },
  {
    name: 'Larvo Delivery Lead',
    email: 'delivery@larvo.com',
    role: 'delivery_manager',
    active: true,
    authProvider: 'local',
    addresses: [
      {
        label: 'Logistics Hub',
        line1: '15 Base Line Road',
        city: 'Colombo',
        province: 'Western Province',
        postalCode: '00900',
        country: 'Sri Lanka',
        phone: '0714567890',
        isDefault: true,
      },
    ],
  },
  {
    name: 'Lanka Weaves Rep',
    email: 'supplier@larvo.com',
    role: 'supplier',
    active: true,
    authProvider: 'local',
    addresses: [
      {
        label: 'Factory Office',
        line1: 'Zone 1, BOI Export Processing Zone',
        city: 'Biyagama',
        province: 'Western Province',
        postalCode: '11672',
        country: 'Sri Lanka',
        phone: '0112987654',
        isDefault: true,
      },
    ],
  },
  {
    name: 'Kasun Perera',
    email: 'customer@larvo.com',
    role: 'customer',
    active: true,
    authProvider: 'local',
    addresses: [
      {
        label: 'Home',
        line1: '24 Flower Road',
        line2: 'Colombo 07',
        city: 'Colombo',
        province: 'Western Province',
        postalCode: '00700',
        country: 'Sri Lanka',
        phone: '0779876543',
        isDefault: true,
      },
      {
        label: 'Parents Home',
        line1: '102 Peradeniya Road',
        city: 'Kandy',
        province: 'Central Province',
        postalCode: '20000',
        country: 'Sri Lanka',
        phone: '0812233445',
        isDefault: false,
      },
    ],
  },
  {
    name: 'Test Customer',
    email: 'customer_test@demo.com',
    role: 'customer',
    active: true,
    authProvider: 'local',
    addresses: [
      {
        label: 'Home',
        line1: '56 Temple Road',
        city: 'Mount Lavinia',
        province: 'Western Province',
        postalCode: '10370',
        country: 'Sri Lanka',
        phone: '0761234567',
        isDefault: true,
      },
    ],
  },
];

export const seedUsers = async () => {
  const passwordHash = await bcrypt.hash('Password123!', 10);

  for (const u of SEED_USERS) {
    await User.updateOne(
      { email: u.email },
      {
        $set: {
          name: u.name,
          email: u.email,
          passwordHash,
          password: passwordHash,
          role: u.role,
          active: u.active,
          authProvider: u.authProvider,
          addresses: u.addresses,
        },
      },
      { upsert: true }
    );
  }
};
