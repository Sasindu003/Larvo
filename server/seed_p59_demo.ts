import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Supplier } from './src/models/Supplier';

dotenv.config();

async function seed() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/shop');
  console.log('Connected to MongoDB');

  const demoSuppliers = [
    {
      companyName: 'Apex Textiles Ltd.',
      name: 'Alice Jenkins',
      email: 'contact@apexfabrics.com',
      phone: '+1 (555) 101-2001',
      address: '100 Industrial Parkway, Greenville, SC 29601, USA',
      status: 'active',
      notes: 'Specializes in high-grade organic cotton, modal jerseys, and linen weaves. Lead time: 14 days.',
    },
    {
      companyName: 'Pacific Weavers Co.',
      name: 'Robert Chen',
      email: 'orders@pacificweavers.com',
      phone: '+1 (555) 202-3002',
      address: '500 Harbor Blvd, Long Beach, CA 90802, USA',
      status: 'active',
      notes: 'Outerwear fabrics, technical twills, water-resistant nylon shells. MOQ: 200 units.',
    },
    {
      companyName: 'Nordic Wool Mills',
      name: 'Clara Lindqvist',
      email: 'sales@nordicwool.com',
      phone: '+1 (555) 303-4003',
      address: '22 Fjord Way, Oslo, Norway',
      status: 'active',
      notes: 'Superfine Merino wool, recycled cashmere blends, and thermal knitwear materials.',
    },
    {
      companyName: 'Himalayan Silk & Cashmere',
      name: 'Tenzing Norgay',
      email: 'info@himalayansilk.com',
      phone: '+1 (555) 404-5004',
      address: '45 Mountain Ridge Rd, Kathmandu, Nepal',
      status: 'active',
      notes: 'Hand-loomed mulberry silk and high-altitude pashmina shawls.',
    },
    {
      companyName: 'Legacy Denim Works (Inactive)',
      name: 'Marcus Brody',
      email: 'brody@legacydenim.com',
      phone: '+1 (555) 505-6005',
      address: '88 Heritage Mill Lane, Greensboro, NC 27401, USA',
      status: 'inactive',
      notes: 'Historical selvedge denim supplier. Deactivated due to mill consolidation.',
    },
  ];

  for (const s of demoSuppliers) {
    await Supplier.findOneAndUpdate(
      { email: s.email },
      { $set: s },
      { upsert: true, new: true }
    );
    console.log(`Seeded supplier: ${s.companyName} (${s.status})`);
  }

  await mongoose.disconnect();
  console.log('Seeding completed.');
}

seed().catch(console.error);
