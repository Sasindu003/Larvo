import { Supplier } from '../models/Supplier';
import { User } from '../models/User';

export const SEED_SUPPLIERS = [
  {
    companyName: 'Lanka Weaves Garments Ltd',
    name: 'Ruwan Jayasinghe',
    email: 'supplier@larvo.com',
    phone: '0112987654',
    address: 'Plot 42, BOI Export Processing Zone, Biyagama, Sri Lanka',
    status: 'active' as const,
    notes: 'Primary supplier for men and women formal shirts, chinos, and cotton blends.',
  },
  {
    companyName: 'Ceylon Stitch & Denim Works',
    name: 'Mahesh Bandara',
    email: 'info@ceylonstitch.lk',
    phone: '0112445566',
    address: '88 Temple Court Industrial Estate, Ratmalana, Sri Lanka',
    status: 'active' as const,
    notes: 'Denim, outerwear, and streetwear manufacturer.',
  },
  {
    companyName: 'Hela Knitwear Mills',
    name: 'Dilani Fernando',
    email: 'contact@helaknitwear.lk',
    phone: '0332244555',
    address: '15 Kandy Road, Mirigama, Western Province, Sri Lanka',
    status: 'active' as const,
    notes: 'Organic cotton t-shirts, sportswear, and loungewear basics.',
  },
  {
    companyName: 'Lanka Threads & Silks',
    name: 'Nalaka Wickramasinghe',
    email: 'nalaka@lankathreads.lk',
    phone: '0812345678',
    address: '14 Raja Veediya, Kandy, Central Province, Sri Lanka',
    status: 'active' as const,
    notes: 'Premium silk, linen fabrics, and traditional handloom textiles.',
  },
];

export const seedSuppliers = async () => {
  const supplierUser = await User.findOne({ email: 'supplier@larvo.com' });

  for (const s of SEED_SUPPLIERS) {
    const isLinkedUser = s.email === 'supplier@larvo.com' && supplierUser;
    const updateDoc: any = {
      name: s.name,
      companyName: s.companyName,
      email: s.email,
      phone: s.phone,
      address: s.address,
      status: s.status,
      notes: s.notes,
    };

    if (isLinkedUser) {
      updateDoc.userId = supplierUser._id;
    }

    const supplierDoc = await Supplier.findOneAndUpdate(
      { email: s.email },
      { $set: updateDoc },
      { upsert: true, new: true }
    );

    if (isLinkedUser && supplierUser && !supplierUser.supplierId) {
      supplierUser.supplierId = supplierDoc._id;
      await supplierUser.save();
    }
  }
};
