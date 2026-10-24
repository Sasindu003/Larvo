import { Setting } from '../models/Setting';

export const DEFAULT_SETTINGS = [
  {
    key: 'currency',
    value: 'Rs.',
    description: 'Default store currency display symbol',
  },
  {
    key: 'currency_code',
    value: 'LKR',
    description: 'ISO 4217 Currency Code',
  },
  {
    key: 'loyalty_points_per_unit',
    value: 1, // 1 point per 100 Rs spent
    description: 'Loyalty points awarded per 100 Rs. spent on completed orders',
  },
  {
    key: 'loyalty_points_redemption_rate',
    value: 1, // 1 point = 1 Rs. discount
    description: 'Value in Rs. for redeeming 1 loyalty point',
  },
  {
    key: 'shipping_fee_standard',
    value: 350,
    description: 'Standard islandwide delivery charge in Rs.',
  },
  {
    key: 'free_shipping_threshold',
    value: 7500,
    description: 'Minimum cart total in Rs. for free islandwide shipping',
  },
  {
    key: 'store_info',
    value: {
      name: 'Larvo Clothing',
      tagline: 'Modern Apparel & Sri Lankan Crafted Wardrobe',
      email: 'support@larvo.com',
      phone: '0112345678',
      address: '45 Galle Face Terrace, Colombo 03, Sri Lanka',
    },
    description: 'Public contact and legal store information',
  },
];

export const seedSettings = async () => {
  for (const s of DEFAULT_SETTINGS) {
    await Setting.updateOne(
      { key: s.key },
      {
        $set: {
          key: s.key,
          value: s.value,
          description: s.description,
        },
      },
      { upsert: true }
    );
  }
};
