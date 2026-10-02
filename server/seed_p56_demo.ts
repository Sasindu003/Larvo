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

  let cust = await User.findOne({ email: 'customer@larvo.com' });
  if (!cust) {
    const hash = await bcrypt.hash('Password123!', 10);
    cust = await User.create({
      name: 'Demo Customer',
      email: 'customer@larvo.com',
      password: hash,
      role: 'customer',
      active: true,
    });
    console.log('Created customer@larvo.com');
  } else {
    console.log('Customer exists:', cust._id);
  }

  // Check if delivered order exists without active return
  let order = await Order.findOne({ user: cust._id, status: 'delivered' });
  if (order) {
    // delete any existing return on this order so the Request Return button is active
    await ReturnRequest.deleteMany({ order: order._id });
    order.deliveredAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await order.save();
    console.log('Updated existing delivered order for return demo:', order._id);
  } else {
    let product = await Product.findOne();
    order = await Order.create({
      user: cust._id,
      items: [
        {
          product: product ? product._id : new mongoose.Types.ObjectId(),
          name: 'Premium Cotton Oxford Shirt',
          image: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=500',
          variantSku: 'OXFORD-SHIRT-M',
          size: 'M',
          color: 'Sky Blue',
          unitPrice: 55,
          quantity: 2,
        },
      ],
      shippingAddress: {
        line1: '45 Lotus Grove',
        city: 'Colombo',
        province: 'Western',
        postalCode: '00300',
        country: 'Sri Lanka',
      },
      discountAmount: 0,
      subtotal: 110,
      shippingFee: 0,
      total: 110,
      status: 'delivered',
      deliveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });
    console.log('Created new delivered order for return demo:', order._id);
  }

  await mongoose.disconnect();
  console.log('Seed finished successfully.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
