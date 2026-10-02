import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './models/User';
import { Wallet } from './models/Wallet';
import { walletService } from './services/wallet.service';

dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/shop');
  const user = await User.findOne({ email: 'customer_test@demo.com' });
  if (!user) {
    console.log('Customer test user not found');
    return;
  }
  const wallet = await walletService.getOrCreateWallet(user._id);
  console.log('Current customer balance:', wallet.balancePoints);
  if (wallet.balancePoints < 50000) {
    await walletService.credit({
      userId: user._id,
      points: 150000,
      type: 'admin_credit',
      idempotencyKey: 'demo_credit_' + Date.now(),
      note: 'Seed points for browser demonstration',
    });
    const updated = await Wallet.findOne({ user: user._id });
    console.log('New customer balance:', updated?.balancePoints);
  }
  await mongoose.disconnect();
}

main().catch(console.error);
