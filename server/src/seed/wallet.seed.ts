import { User } from '../models/User';
import { Wallet } from '../models/Wallet';
import { PointsTransaction } from '../models/PointsTransaction';

export const seedWallets = async () => {
  const customers = await User.find({ role: 'customer' });

  for (const customer of customers) {
    let wallet = await Wallet.findOne({ user: customer._id });

    if (!wallet) {
      wallet = await Wallet.create({
        user: customer._id,
        balancePoints: 2500, // 2500 points = Rs. 2,500 loyalty credit
      });

      await PointsTransaction.create({
        wallet: wallet._id,
        user: customer._id,
        type: 'admin_credit',
        direction: 'credit',
        points: 2500,
        balanceAfter: 2500,
        idempotencyKey: `seed_welcome_bonus_${customer._id.toString()}`,
        note: 'Welcome loyalty reward points bonus',
      });
    }
  }
};
