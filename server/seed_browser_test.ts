import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { User } from './src/models/User';
import { Order } from './src/models/Order';
import { Product } from './src/models/Product';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shop';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const adminOwner = await User.findOneAndUpdate(
    { email: 'admin_portal@test.com' },
    {
      name: 'Priya Fernando (Owner)',
      email: 'admin_portal@test.com',
      passwordHash,
      role: 'owner',
      active: true,
      authProvider: 'local',
    },
    { upsert: true, new: true }
  );

  const existingStaff = await User.findOneAndUpdate(
    { email: 'staff_demo@test.com' },
    {
      name: 'Kamal Perera (Staff)',
      email: 'staff_demo@test.com',
      passwordHash,
      role: 'staff',
      active: true,
      authProvider: 'local',
    },
    { upsert: true, new: true }
  );

  const deliveryUser = await User.findOneAndUpdate(
    { email: 'delivery_portal@test.com' },
    {
      name: 'Nimal Silva (Delivery Mgr)',
      email: 'delivery_portal@test.com',
      passwordHash,
      role: 'delivery_manager',
      active: true,
      authProvider: 'local',
    },
    { upsert: true, new: true }
  );

  const customerUser = await User.findOneAndUpdate(
    { email: 'customer_portal@test.com' },
    {
      name: 'Anula Fernando',
      email: 'customer_portal@test.com',
      passwordHash,
      role: 'customer',
      active: true,
      authProvider: 'local',
    },
    { upsert: true, new: true }
  );

  let product = await Product.findOne({ status: 'active' });
  if (!product) {
    product = await Product.create({
      name: 'Classic Linen Shirt',
      slug: `classic-linen-shirt-${Date.now()}`,
      description: 'Breathable linen shirt',
      basePrice: 4200,
      status: 'active',
      variants: [
        {
          sku: 'CLS-WHT-M',
          size: 'M',
          color: 'White',
          stock: 50,
          price: 4200,
        },
      ],
    });
  }

  // Ensure an order in ready_for_dispatch
  await Order.findOneAndUpdate(
    { 'shippingAddress.line1': '88 Galle Face Terrace' },
    {
      user: customerUser._id,
      items: [
        {
          product: product._id,
          variantSku: product.variants[0]?.sku || 'CLS-WHT-M',
          name: product.name,
          image: '/uploads/shirt.jpg',
          size: 'M',
          color: 'White',
          unitPrice: 4200,
          quantity: 2,
        },
      ],
      subtotal: 8400,
      shippingFee: 350,
      discountTotal: 0,
      total: 8750,
      status: 'ready_for_dispatch',
      trackingNumber: null,
      shippingAddress: {
        line1: '88 Galle Face Terrace',
        city: 'Colombo 03',
        province: 'Western',
        postalCode: '00300',
        country: 'Sri Lanka',
      },
    },
    { upsert: true, new: true }
  );

  // Ensure an order in in_transit
  await Order.findOneAndUpdate(
    { 'shippingAddress.line1': '14 Peradeniya Road' },
    {
      user: customerUser._id,
      items: [
        {
          product: product._id,
          variantSku: product.variants[0]?.sku || 'CLS-WHT-M',
          name: product.name,
          image: '/uploads/shirt.jpg',
          size: 'L',
          color: 'Navy',
          unitPrice: 4200,
          quantity: 1,
        },
      ],
      subtotal: 4200,
      shippingFee: 350,
      discountTotal: 0,
      total: 4550,
      status: 'in_transit',
      trackingNumber: 'TRK-KANDY-7788',
      shippingAddress: {
        line1: '14 Peradeniya Road',
        city: 'Kandy',
        province: 'Central',
        postalCode: '20000',
        country: 'Sri Lanka',
      },
    },
    { upsert: true, new: true }
  );

  console.log('Seeded delivery manager and orders.');
  await mongoose.disconnect();
}

seed().catch(console.error);
