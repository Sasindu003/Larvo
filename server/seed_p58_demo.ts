import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { User } from './src/models/User';
import { Order } from './src/models/Order';
import { Product } from './src/models/Product';
import { ReturnRequest } from './src/models/ReturnRequest';

dotenv.config();

async function seed() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/shop');
  console.log('Connected to DB');

  const hash = await bcrypt.hash('Password123!', 10);

  // 1. Ensure Delivery Manager User
  let dm = await User.findOne({ email: 'delivery@larvo.com' });
  if (!dm) {
    dm = await User.create({
      name: 'Alex Delivery',
      email: 'delivery@larvo.com',
      passwordHash: hash,
      role: 'delivery_manager',
      active: true,
    });
    console.log('Created delivery@larvo.com');
  } else {
    dm.role = 'delivery_manager';
    await dm.save();
    console.log('Updated delivery@larvo.com to delivery_manager');
  }

  // 2. Ensure Admin User
  let admin = await User.findOne({ email: 'admin@larvo.com' });
  if (!admin) {
    admin = await User.create({
      name: 'Admin User',
      email: 'admin@larvo.com',
      passwordHash: hash,
      role: 'admin',
      active: true,
    });
    console.log('Created admin@larvo.com');
  }

  // 3. Ensure Customer User
  let cust = await User.findOne({ email: 'customer@larvo.com' });
  if (!cust) {
    cust = await User.create({
      name: 'Demo Customer',
      email: 'customer@larvo.com',
      passwordHash: hash,
      role: 'customer',
      active: true,
    });
    console.log('Created customer@larvo.com');
  }

  // 4. Create sample orders & returns for P58 demo
  const sampleProduct = await Product.findOne();
  const prodId = sampleProduct ? sampleProduct._id : new mongoose.Types.ObjectId();

  // Return 1: Pickup Scheduled
  const orderScheduled = await Order.create({
    orderNumber: `ORD-DEMO-${Date.now().toString().slice(-4)}-1`,
    user: cust._id,
    items: [
      {
        product: prodId,
        name: 'Slim Fit Linen Blazer',
        image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500',
        variantSku: 'BLAZER-LINEN-40R',
        size: '40R',
        color: 'Oatmeal',
        unitPrice: 140,
        quantity: 1,
      },
    ],
    shippingAddress: {
      recipientName: 'Demo Customer',
      line1: '742 Evergreen Terrace',
      city: 'Springfield',
      province: 'OR',
      postalCode: '97477',
      country: 'USA',
    },
    contactPhone: '+1 (555) 987-6543',
    subtotal: 140,
    discountAmount: 14,
    shippingFee: 0,
    total: 126,
    status: 'delivered',
    deliveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  });

  const retScheduled = await ReturnRequest.create({
    order: orderScheduled._id,
    user: cust._id,
    items: [
      {
        orderItemRef: 0,
        sku: 'BLAZER-LINEN-40R',
        qty: 1,
        reason: 'Sleeves are slightly too long for my frame',
      },
    ],
    status: 'pickup_scheduled',
    estimatedRefundPoints: 12600,
  });

  // Return 2: Picked Up (In Transit)
  const orderPickedUp = await Order.create({
    orderNumber: `ORD-DEMO-${Date.now().toString().slice(-4)}-2`,
    user: cust._id,
    items: [
      {
        product: prodId,
        name: 'Italian Wool Overcoat',
        image: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=500',
        variantSku: 'COAT-WOOL-L',
        size: 'L',
        color: 'Camel',
        unitPrice: 220,
        quantity: 1,
      },
    ],
    shippingAddress: {
      recipientName: 'Demo Customer',
      line1: '1204 Pine Valley Way',
      city: 'Eugene',
      province: 'OR',
      postalCode: '97401',
      country: 'USA',
    },
    contactPhone: '+1 (555) 987-6543',
    subtotal: 220,
    discountAmount: 20,
    shippingFee: 0,
    total: 200,
    status: 'delivered',
    deliveredAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  });

  const retPickedUp = await ReturnRequest.create({
    order: orderPickedUp._id,
    user: cust._id,
    items: [
      {
        orderItemRef: 0,
        sku: 'COAT-WOOL-L',
        qty: 1,
        reason: 'Fabric feels heavier than expected',
      },
    ],
    status: 'picked_up',
    estimatedRefundPoints: 20000,
  });

  // Return 3: Received at Hub (Ready for Admin Refund)
  const orderReceived = await Order.create({
    orderNumber: `ORD-DEMO-${Date.now().toString().slice(-4)}-3`,
    user: cust._id,
    items: [
      {
        product: prodId,
        name: 'Supima Cotton Crewneck',
        image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500',
        variantSku: 'TEE-SUPIMA-M',
        size: 'M',
        color: 'Sage Green',
        unitPrice: 45,
        quantity: 2,
      },
    ],
    shippingAddress: {
      recipientName: 'Demo Customer',
      line1: '88 Riverfront Plaza',
      city: 'Portland',
      province: 'OR',
      postalCode: '97201',
      country: 'USA',
    },
    contactPhone: '+1 (555) 987-6543',
    subtotal: 90,
    discountAmount: 0,
    shippingFee: 0,
    total: 90,
    status: 'delivered',
    deliveredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  });

  const retReceived = await ReturnRequest.create({
    order: orderReceived._id,
    user: cust._id,
    items: [
      {
        orderItemRef: 0,
        sku: 'TEE-SUPIMA-M',
        qty: 2,
        reason: 'Ordered wrong color by mistake',
      },
    ],
    status: 'received',
    estimatedRefundPoints: 9000,
  });

  console.log('Seeded demo returns:');
  console.log('- Pickup Scheduled:', retScheduled._id);
  console.log('- Picked Up:', retPickedUp._id);
  console.log('- Received:', retReceived._id);

  await mongoose.disconnect();
}

seed().catch(console.error);
