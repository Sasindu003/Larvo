import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Category } from '../models/Category';
import { Product, ProductSize } from '../models/Product';

dotenv.config();

interface RawProductSeed {
  name: string;
  slug: string;
  categorySlug: string;
  description: string;
  basePrice: number;
  discountPrice: number | null;
  ratingAvg: number;
  ratingCount: number;
  images: string[];
  status: 'active' | 'draft' | 'archived';
  daysAgoCreated: number; // for varied createdAt dates
  variants: {
    size: ProductSize;
    color: string;
    material: string;
    sku: string;
    stock: number;
  }[];
}

export const PRODUCTS_SEED_DATA: RawProductSeed[] = [
  // ─── MEN'S (4 products) ───────────────────────────────────────────────────
  {
    name: 'Classic Tailored Navy Suit Blazer',
    slug: 'classic-tailored-navy-suit-blazer',
    categorySlug: 'mens',
    description: 'Impeccable wool-blend tailored suit jacket with notch lapels, structured shoulders, and dual vent back. Perfect for formal business and evening occasions.',
    basePrice: 289,
    discountPrice: 229,
    ratingAvg: 4.8,
    ratingCount: 34,
    images: [
      'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 2,
    variants: [
      { size: 'S', color: 'Navy', material: 'Wool Blend', sku: 'M-BLZ-NVY-S', stock: 8 },
      { size: 'M', color: 'Navy', material: 'Wool Blend', sku: 'M-BLZ-NVY-M', stock: 15 },
      { size: 'L', color: 'Navy', material: 'Wool Blend', sku: 'M-BLZ-NVY-L', stock: 12 },
      { size: 'XL', color: 'Navy', material: 'Wool Blend', sku: 'M-BLZ-NVY-XL', stock: 4 },
    ],
  },
  {
    name: 'Slim Fit Oxford Cotton Shirt',
    slug: 'slim-fit-oxford-cotton-shirt',
    categorySlug: 'mens',
    description: 'Crisp 100% organic cotton Oxford shirt featuring button-down collar, buttoned cuffs, and breathable weave.',
    basePrice: 89,
    discountPrice: null,
    ratingAvg: 4.6,
    ratingCount: 58,
    images: [
      'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1620012253295-c15cc3e65df4?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 15,
    variants: [
      { size: 'S', color: 'White', material: '100% Cotton', sku: 'M-SHR-WHT-S', stock: 20 },
      { size: 'M', color: 'Light Blue', material: '100% Cotton', sku: 'M-SHR-BLU-M', stock: 25 },
      { size: 'L', color: 'White', material: '100% Cotton', sku: 'M-SHR-WHT-L', stock: 18 },
    ],
  },
  {
    name: 'Vintage Leather Moto Jacket',
    slug: 'vintage-leather-moto-jacket',
    categorySlug: 'mens',
    description: 'Hand-burnished genuine lambskin leather jacket with asymmetric zip closure, quilted shoulder detail, and heavy chrome hardware.',
    basePrice: 450,
    discountPrice: 380,
    ratingAvg: 4.9,
    ratingCount: 19,
    images: [
      'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 5,
    variants: [
      { size: 'M', color: 'Black', material: 'Genuine Lambskin', sku: 'M-JKT-BLK-M', stock: 5 },
      { size: 'L', color: 'Dark Brown', material: 'Genuine Lambskin', sku: 'M-JKT-BRN-L', stock: 3 },
    ],
  },
  {
    name: 'Minimalist Merino Wool Crewneck',
    slug: 'minimalist-merino-wool-crewneck',
    categorySlug: 'mens',
    description: 'Ultra-fine Italian Merino wool sweater with ribbed cuffs and hem. Lightweight insulation suitable for year-round layering.',
    basePrice: 140,
    discountPrice: null,
    ratingAvg: 4.5,
    ratingCount: 12,
    images: [
      'https://images.unsplash.com/photo-1614676471928-2ed0ad1061a4?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 40,
    variants: [
      // Out of stock product test case 1
      { size: 'M', color: 'Charcoal', material: 'Merino Wool', sku: 'M-SWT-CHR-M', stock: 0 },
      { size: 'L', color: 'Oatmeal', material: 'Merino Wool', sku: 'M-SWT-OAT-L', stock: 0 },
    ],
  },

  // ─── WOMEN'S (4 products) ─────────────────────────────────────────────────
  {
    name: 'Silk Wrap Evening Midi Dress',
    slug: 'silk-wrap-evening-midi-dress',
    categorySlug: 'womens',
    description: 'Flowing Mulberry silk wrap midi dress with subtle V-neckline, self-tie belt, and flattering asymmetrical drape.',
    basePrice: 320,
    discountPrice: 260,
    ratingAvg: 4.9,
    ratingCount: 42,
    images: [
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 1,
    variants: [
      { size: 'XS', color: 'Emerald Green', material: '100% Silk', sku: 'W-DRS-EMR-XS', stock: 6 },
      { size: 'S', color: 'Ruby Red', material: '100% Silk', sku: 'W-DRS-RUB-S', stock: 10 },
      { size: 'M', color: 'Emerald Green', material: '100% Silk', sku: 'W-DRS-EMR-M', stock: 8 },
    ],
  },
  {
    name: 'Oversized Cashmere Blend Coat',
    slug: 'oversized-cashmere-blend-coat',
    categorySlug: 'womens',
    description: 'Luxurious double-faced wool and cashmere long coat with notched lapels and horn buttons. Wide relaxed silhouette.',
    basePrice: 590,
    discountPrice: null,
    ratingAvg: 4.7,
    ratingCount: 28,
    images: [
      'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 10,
    variants: [
      { size: 'S', color: 'Camel', material: 'Cashmere Wool', sku: 'W-COT-CML-S', stock: 7 },
      { size: 'M', color: 'Camel', material: 'Cashmere Wool', sku: 'W-COT-CML-M', stock: 14 },
      { size: 'L', color: 'Black', material: 'Cashmere Wool', sku: 'W-COT-BLK-L', stock: 5 },
    ],
  },
  {
    name: 'High-Waisted Tailored Linen Trousers',
    slug: 'high-waisted-tailored-linen-trousers',
    categorySlug: 'womens',
    description: 'Breathable Belgian linen wide-leg trousers featuring subtle front pleats and deep side slant pockets.',
    basePrice: 165,
    discountPrice: 135,
    ratingAvg: 4.4,
    ratingCount: 16,
    images: [
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 25,
    variants: [
      { size: 'XS', color: 'Sand', material: '100% Linen', sku: 'W-TRS-SND-XS', stock: 11 },
      { size: 'S', color: 'Sand', material: '100% Linen', sku: 'W-TRS-SND-S', stock: 15 },
      { size: 'M', color: 'Off-White', material: '100% Linen', sku: 'W-TRS-WHT-M', stock: 9 },
    ],
  },
  {
    name: 'Ribbed Knit Bodycon Mini Dress',
    slug: 'ribbed-knit-bodycon-mini-dress',
    categorySlug: 'womens',
    description: 'Sculpting stretch-knit bodycon dress with sweetheart neckline and short cap sleeves.',
    basePrice: 110,
    discountPrice: null,
    ratingAvg: 4.3,
    ratingCount: 9,
    images: [
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 50,
    variants: [
      { size: 'S', color: 'Beige', material: 'Viscose Stretch', sku: 'W-DRS-BGE-S', stock: 14 },
      { size: 'M', color: 'Black', material: 'Viscose Stretch', sku: 'W-DRS-BLK-M', stock: 22 },
    ],
  },

  // ─── KIDS (4 products) ─────────────────────────────────────────────────────
  {
    name: 'Organic Cotton Graphic Hoodie',
    slug: 'kids-organic-cotton-graphic-hoodie',
    categorySlug: 'kids',
    description: 'Super soft brushed fleece hoodie made with GOTS-certified organic cotton. Playful chest print and cozy kangaroo pocket.',
    basePrice: 55,
    discountPrice: 42,
    ratingAvg: 4.8,
    ratingCount: 31,
    images: [
      'https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 3,
    variants: [
      { size: 'XS', color: 'Mustard Yellow', material: 'Organic Cotton', sku: 'K-HOD-YEL-XS', stock: 12 },
      { size: 'S', color: 'Forest Green', material: 'Organic Cotton', sku: 'K-HOD-GRN-S', stock: 18 },
    ],
  },
  {
    name: 'Durable Denim Overall Jumpsuit',
    slug: 'kids-durable-denim-overall-jumpsuit',
    categorySlug: 'kids',
    description: 'Classic unisex denim overalls with adjustable shoulder straps, brass buttons, and reinforced double-layer knees.',
    basePrice: 65,
    discountPrice: null,
    ratingAvg: 4.6,
    ratingCount: 17,
    images: [
      'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 18,
    variants: [
      { size: 'XS', color: 'Medium Wash', material: 'Cotton Denim', sku: 'K-OVR-DEN-XS', stock: 10 },
      { size: 'S', color: 'Medium Wash', material: 'Cotton Denim', sku: 'K-OVR-DEN-S', stock: 15 },
      { size: 'M', color: 'Dark Wash', material: 'Cotton Denim', sku: 'K-OVR-DRK-M', stock: 8 },
    ],
  },
  {
    name: 'Cozy Sherpa Lined Winter Jacket',
    slug: 'kids-cozy-sherpa-lined-winter-jacket',
    categorySlug: 'kids',
    description: 'Wind-resistant outer shell with ultra-warm faux-sherpa lining and detachable fleece hood.',
    basePrice: 85,
    discountPrice: 68,
    ratingAvg: 4.9,
    ratingCount: 23,
    images: [
      'https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 7,
    variants: [
      { size: 'S', color: 'Navy', material: 'Polyester Sherpa', sku: 'K-JKT-NVY-S', stock: 16 },
      { size: 'M', color: 'Red', material: 'Polyester Sherpa', sku: 'K-JKT-RED-M', stock: 12 },
    ],
  },
  {
    name: 'Active Stretch Jogger Sweatpants',
    slug: 'kids-active-stretch-jogger-sweatpants',
    categorySlug: 'kids',
    description: 'Flexible French terry joggers with elastic drawstring waistband and ribbed ankle cuffs.',
    basePrice: 40,
    discountPrice: null,
    ratingAvg: 4.4,
    ratingCount: 14,
    images: [
      'https://images.unsplash.com/photo-1514090458221-65bb69cf63e6?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 35,
    variants: [
      { size: 'S', color: 'Heather Gray', material: 'Cotton Blend', sku: 'K-JOG-GRY-S', stock: 25 },
      { size: 'M', color: 'Black', material: 'Cotton Blend', sku: 'K-JOG-BLK-M', stock: 30 },
    ],
  },

  // ─── STREETWEAR (4 products) ──────────────────────────────────────────────
  {
    name: 'Heavyweight Heavy Cotton Graphic Hoodie',
    slug: 'heavyweight-heavy-cotton-graphic-hoodie',
    categorySlug: 'streetwear',
    description: '500GSM custom boxy fleece hoodie featuring puff-print typography on chest and drop shoulder silhouette.',
    basePrice: 145,
    discountPrice: null,
    ratingAvg: 4.8,
    ratingCount: 67,
    images: [
      'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 4,
    variants: [
      { size: 'S', color: 'Washed Black', material: '500GSM Cotton', sku: 'ST-HOD-BLK-S', stock: 12 },
      { size: 'M', color: 'Washed Black', material: '500GSM Cotton', sku: 'ST-HOD-BLK-M', stock: 20 },
      { size: 'L', color: 'Slate Gray', material: '500GSM Cotton', sku: 'ST-HOD-GRY-L', stock: 15 },
      { size: 'XL', color: 'Washed Black', material: '500GSM Cotton', sku: 'ST-HOD-BLK-XL', stock: 8 },
    ],
  },
  {
    name: 'Tactical Multi-Pocket Cargo Pants',
    slug: 'tactical-multi-pocket-cargo-pants',
    categorySlug: 'streetwear',
    description: 'Relaxed fit ripstop cotton cargo pants with 8 functional utility pockets, adjustable ankle ties, and reinforced seat.',
    basePrice: 130,
    discountPrice: 105,
    ratingAvg: 4.7,
    ratingCount: 54,
    images: [
      'https://images.unsplash.com/photo-1517445312882-bc9910d016b7?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 12,
    variants: [
      { size: 'M', color: 'Olive Drab', material: 'Ripstop Cotton', sku: 'ST-CRG-OLV-M', stock: 14 },
      { size: 'L', color: 'Stealth Black', material: 'Ripstop Cotton', sku: 'ST-CRG-BLK-L', stock: 19 },
      { size: 'XL', color: 'Olive Drab', material: 'Ripstop Cotton', sku: 'ST-CRG-OLV-XL', stock: 7 },
    ],
  },
  {
    name: 'Overdyed Boxy Vintage Tee',
    slug: 'overdyed-boxy-vintage-tee',
    categorySlug: 'streetwear',
    description: 'Garment-dyed 260GSM thick cotton tee with wide relaxed sleeve sleeves and distressed hem accents.',
    basePrice: 65,
    discountPrice: null,
    ratingAvg: 4.5,
    ratingCount: 38,
    images: [
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 22,
    variants: [
      { size: 'S', color: 'Washed Vintage Red', material: '260GSM Cotton', sku: 'ST-TEE-RED-S', stock: 18 },
      { size: 'M', color: 'Washed Vintage Red', material: '260GSM Cotton', sku: 'ST-TEE-RED-M', stock: 25 },
      { size: 'L', color: 'Faded Black', material: '260GSM Cotton', sku: 'ST-TEE-BLK-L', stock: 22 },
    ],
  },
  {
    name: 'Reflective Technical Windbreaker',
    slug: 'reflective-technical-windbreaker',
    categorySlug: 'streetwear',
    description: 'Water-repellent nylon jacket with 3M reflective taping, waterproof zippers, and storm hood.',
    basePrice: 180,
    discountPrice: 149,
    ratingAvg: 4.6,
    ratingCount: 21,
    images: [
      'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 45,
    variants: [
      // Out of stock product test case 2
      { size: 'M', color: 'Silver Reflective', material: 'Nylon Ripstop', sku: 'ST-WND-SLV-M', stock: 0 },
      { size: 'L', color: 'Silver Reflective', material: 'Nylon Ripstop', sku: 'ST-WND-SLV-L', stock: 0 },
    ],
  },

  // ─── FORMAL (4 products) ─────────────────────────────────────────────────
  {
    name: 'Double-Breasted Wool Tuxedo Jacket',
    slug: 'double-breasted-wool-tuxedo-jacket',
    categorySlug: 'formal',
    description: 'Black tie ready double-breasted tuxedo jacket featuring satin peak lapels and covered satin buttons.',
    basePrice: 490,
    discountPrice: 410,
    ratingAvg: 4.9,
    ratingCount: 15,
    images: [
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 6,
    variants: [
      { size: 'M', color: 'Midnight Black', material: 'Italian Wool Satin', sku: 'FR-TUX-BLK-M', stock: 4 },
      { size: 'L', color: 'Midnight Black', material: 'Italian Wool Satin', sku: 'FR-TUX-BLK-L', stock: 6 },
    ],
  },
  {
    name: 'Italian Calfskin Oxford Dress Shoes',
    slug: 'italian-calfskin-oxford-dress-shoes',
    categorySlug: 'formal',
    description: 'Handcrafted Goodyear-welted dress shoes with polished full-grain calfskin leather and stacked heel.',
    basePrice: 295,
    discountPrice: null,
    ratingAvg: 4.8,
    ratingCount: 29,
    images: [
      'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 14,
    variants: [
      { size: 'M', color: 'Chestnut Brown', material: 'Calfskin Leather', sku: 'FR-SHO-BRN-M', stock: 9 },
      { size: 'L', color: 'Black', material: 'Calfskin Leather', sku: 'FR-SHO-BLK-L', stock: 12 },
    ],
  },
  {
    name: 'Pleated Satin Evening Gown',
    slug: 'pleated-satin-evening-gown',
    categorySlug: 'formal',
    description: 'Floor-length liquid satin gown featuring delicate shoulder straps, pleated bodice, and thigh-high side slit.',
    basePrice: 380,
    discountPrice: 310,
    ratingAvg: 4.9,
    ratingCount: 37,
    images: [
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 8,
    variants: [
      { size: 'XS', color: 'Champagne', material: 'Duchess Satin', sku: 'FR-GWN-CHP-XS', stock: 5 },
      { size: 'S', color: 'Champagne', material: 'Duchess Satin', sku: 'FR-GWN-CHP-S', stock: 8 },
      { size: 'M', color: 'Navy', material: 'Duchess Satin', sku: 'FR-GWN-NVY-M', stock: 6 },
    ],
  },
  {
    name: 'French Cuff Cotton Tuxedo Shirt',
    slug: 'french-cuff-cotton-tuxedo-shirt',
    categorySlug: 'formal',
    description: 'Formal Marcella bib front dress shirt with French cuffs, removable stud buttons, and spread collar.',
    basePrice: 120,
    discountPrice: null,
    ratingAvg: 4.7,
    ratingCount: 18,
    images: [
      'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 28,
    variants: [
      { size: 'S', color: 'Pure White', material: 'Marcella Cotton', sku: 'FR-SHR-WHT-S', stock: 15 },
      { size: 'M', color: 'Pure White', material: 'Marcella Cotton', sku: 'FR-SHR-WHT-M', stock: 22 },
      { size: 'L', color: 'Pure White', material: 'Marcella Cotton', sku: 'FR-SHR-WHT-L', stock: 17 },
    ],
  },

  // ─── CASUAL (4 products) ─────────────────────────────────────────────────
  {
    name: 'Relaxed Fit Heavyweight Denim Jacket',
    slug: 'relaxed-fit-heavyweight-denim-jacket',
    categorySlug: 'casual',
    description: '14oz rigid indigo denim trucker jacket with shank buttons, twin chest pockets, and adjustable waist tabs.',
    basePrice: 135,
    discountPrice: 110,
    ratingAvg: 4.7,
    ratingCount: 51,
    images: [
      'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 9,
    variants: [
      { size: 'S', color: 'Vintage Wash', material: '14oz Denim', sku: 'CS-DNM-VNT-S', stock: 10 },
      { size: 'M', color: 'Vintage Wash', material: '14oz Denim', sku: 'CS-DNM-VNT-M', stock: 18 },
      { size: 'L', color: 'Dark Stonewash', material: '14oz Denim', sku: 'CS-DNM-DRK-L', stock: 14 },
    ],
  },
  {
    name: 'Soft Touch Slub Cotton Polo',
    slug: 'soft-touch-slub-cotton-polo',
    categorySlug: 'casual',
    description: 'Textured slub cotton short-sleeve polo shirt with 3-button placket and mother-of-pearl buttons.',
    basePrice: 65,
    discountPrice: null,
    ratingAvg: 4.4,
    ratingCount: 22,
    images: [
      'https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 16,
    variants: [
      { size: 'S', color: 'Sage Green', material: 'Slub Cotton', sku: 'CS-PLO-SGE-S', stock: 15 },
      { size: 'M', color: 'Terracotta', material: 'Slub Cotton', sku: 'CS-PLO-TER-M', stock: 20 },
      { size: 'L', color: 'Navy', material: 'Slub Cotton', sku: 'CS-PLO-NVY-L', stock: 17 },
    ],
  },
  {
    name: 'Straight Leg Chino Trousers',
    slug: 'straight-leg-chino-trousers',
    categorySlug: 'casual',
    description: 'Versatile stretch cotton twill chinos with clean front pockets and buttoned back welt pockets.',
    basePrice: 95,
    discountPrice: 79,
    ratingAvg: 4.6,
    ratingCount: 39,
    images: [
      'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 20,
    variants: [
      { size: 'S', color: 'Khaki', material: 'Stretch Cotton Twill', sku: 'CS-CHN-KHK-S', stock: 18 },
      { size: 'M', color: 'Khaki', material: 'Stretch Cotton Twill', sku: 'CS-CHN-KHK-M', stock: 25 },
      { size: 'L', color: 'Navy', material: 'Stretch Cotton Twill', sku: 'CS-CHN-NVY-L', stock: 21 },
    ],
  },
  {
    name: 'Washed Canvas Slip-On Sneakers',
    slug: 'washed-canvas-slip-on-sneakers',
    categorySlug: 'casual',
    description: 'Comfortable everyday slip-on shoes with durable vulcanized rubber sole and cushioned memory foam footbed.',
    basePrice: 75,
    discountPrice: null,
    ratingAvg: 4.3,
    ratingCount: 16,
    images: [
      'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 33,
    variants: [
      { size: 'M', color: 'Off-White', material: 'Canvas', sku: 'CS-SNK-WHT-M', stock: 12 },
      { size: 'L', color: 'Charcoal', material: 'Canvas', sku: 'CS-SNK-CHR-L', stock: 19 },
    ],
  },

  // ─── SPORTSWEAR (4 products) ─────────────────────────────────────────────
  {
    name: 'Pro Performance Seamless Leggings',
    slug: 'pro-performance-seamless-leggings',
    categorySlug: 'sportswear',
    description: 'High-waisted squat-proof seamless compression leggings with moisture-wicking technology and side phone pocket.',
    basePrice: 85,
    discountPrice: 69,
    ratingAvg: 4.9,
    ratingCount: 88,
    images: [
      'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 2,
    variants: [
      { size: 'XS', color: 'Plum', material: 'Spandex Blend', sku: 'SP-LEG-PLM-XS', stock: 14 },
      { size: 'S', color: 'Plum', material: 'Spandex Blend', sku: 'SP-LEG-PLM-S', stock: 22 },
      { size: 'M', color: 'Midnight Black', material: 'Spandex Blend', sku: 'SP-LEG-BLK-M', stock: 19 },
    ],
  },
  {
    name: 'Ultralight Running Zip Jacket',
    slug: 'ultralight-running-zip-jacket',
    categorySlug: 'sportswear',
    description: 'Wind-resistant 4-way stretch active jacket with thumbhole cuffs, mesh ventilation back panel, and reflective detailing.',
    basePrice: 110,
    discountPrice: null,
    ratingAvg: 4.7,
    ratingCount: 30,
    images: [
      'https://images.unsplash.com/photo-1518459031867-a89b944bffe4?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 11,
    variants: [
      { size: 'S', color: 'Electric Blue', material: 'Nylon Spandex', sku: 'SP-JKT-BLU-S', stock: 11 },
      { size: 'M', color: 'Electric Blue', material: 'Nylon Spandex', sku: 'SP-JKT-BLU-M', stock: 17 },
      { size: 'L', color: 'Black', material: 'Nylon Spandex', sku: 'SP-JKT-BLK-L', stock: 14 },
    ],
  },
  {
    name: 'Quick-Dry Athletic Training Shorts',
    slug: 'quick-dry-athletic-training-shorts',
    categorySlug: 'sportswear',
    description: 'Lightweight 7-inch inseam workout shorts with built-in compression liner, zippered key pocket, and elastic drawstring waist.',
    basePrice: 55,
    discountPrice: 44,
    ratingAvg: 4.6,
    ratingCount: 45,
    images: [
      'https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 24,
    variants: [
      { size: 'S', color: 'Charcoal Gray', material: 'Polyester Mesh', sku: 'SP-SRT-GRY-S', stock: 20 },
      { size: 'M', color: 'Black', material: 'Polyester Mesh', sku: 'SP-SRT-BLK-M', stock: 28 },
      { size: 'L', color: 'Black', material: 'Polyester Mesh', sku: 'SP-SRT-BLK-L', stock: 24 },
    ],
  },
  {
    name: 'High Impact Padded Sports Bra',
    slug: 'high-impact-padded-sports-bra',
    categorySlug: 'sportswear',
    description: 'Maximum support criss-cross racerback sports bra with removable molded cups and breathable underband.',
    basePrice: 50,
    discountPrice: null,
    ratingAvg: 4.5,
    ratingCount: 33,
    images: [
      'https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 38,
    variants: [
      { size: 'XS', color: 'Coral', material: 'Polyamide', sku: 'SP-BRA-CRL-XS', stock: 15 },
      { size: 'S', color: 'Coral', material: 'Polyamide', sku: 'SP-BRA-CRL-S', stock: 18 },
      { size: 'M', color: 'Black', material: 'Polyamide', sku: 'SP-BRA-BLK-M', stock: 22 },
    ],
  },

  // ─── SEASONAL COLLECTIONS (4 products) ────────────────────────────────────
  {
    name: 'Autumn Velvet Trench Coat',
    slug: 'autumn-velvet-trench-coat',
    categorySlug: 'seasonal-collections',
    description: 'Limited edition plush cotton-velvet double-breasted trench coat in rich rust brown with storm flap and tortoiseshell buckle belt.',
    basePrice: 420,
    discountPrice: 350,
    ratingAvg: 4.9,
    ratingCount: 26,
    images: [
      'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 3,
    variants: [
      { size: 'S', color: 'Rust Brown', material: 'Cotton Velvet', sku: 'SN-TRN-RST-S', stock: 6 },
      { size: 'M', color: 'Rust Brown', material: 'Cotton Velvet', sku: 'SN-TRN-RST-M', stock: 9 },
      { size: 'L', color: 'Deep Burgundy', material: 'Cotton Velvet', sku: 'SN-TRN-BUR-L', stock: 5 },
    ],
  },
  {
    name: 'Winter Fair Isle Alpaca Knit Sweater',
    slug: 'winter-fair-isle-alpaca-knit-sweater',
    categorySlug: 'seasonal-collections',
    description: 'Chunky hand-knit Baby Alpaca wool sweater with traditional Fair Isle pattern around crew neck yoke.',
    basePrice: 210,
    discountPrice: null,
    ratingAvg: 4.8,
    ratingCount: 39,
    images: [
      'https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 13,
    variants: [
      { size: 'S', color: 'Cream / Navy', material: 'Baby Alpaca', sku: 'SN-SWT-CRM-S', stock: 8 },
      { size: 'M', color: 'Cream / Navy', material: 'Baby Alpaca', sku: 'SN-SWT-CRM-M', stock: 12 },
      { size: 'L', color: 'Cream / Navy', material: 'Baby Alpaca', sku: 'SN-SWT-CRM-L', stock: 10 },
    ],
  },
  {
    name: 'Summer Resort Floral Linen Shirt',
    slug: 'summer-resort-floral-linen-shirt',
    categorySlug: 'seasonal-collections',
    description: 'Camp-collar short sleeve linen resort shirt featuring hand-painted tropical botanical print.',
    basePrice: 115,
    discountPrice: 89,
    ratingAvg: 4.7,
    ratingCount: 19,
    images: [
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 26,
    variants: [
      { size: 'S', color: 'Sage Botanical', material: '100% Linen', sku: 'SN-SHR-SGE-S', stock: 14 },
      { size: 'M', color: 'Sage Botanical', material: '100% Linen', sku: 'SN-SHR-SGE-M', stock: 18 },
      { size: 'L', color: 'Ocean Blue', material: '100% Linen', sku: 'SN-SHR-BLU-L', stock: 11 },
    ],
  },
  {
    name: 'Spring Pastel Pleated Midi Skirt',
    slug: 'spring-pastel-pleated-midi-skirt',
    categorySlug: 'seasonal-collections',
    description: 'Sunray pleated ombre chiffon midi skirt with concealed elastic waistband.',
    basePrice: 130,
    discountPrice: null,
    ratingAvg: 4.6,
    ratingCount: 14,
    images: [
      'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 42,
    variants: [
      { size: 'XS', color: 'Lavender Ombre', material: 'Chiffon', sku: 'SN-SKT-LAV-XS', stock: 9 },
      { size: 'S', color: 'Lavender Ombre', material: 'Chiffon', sku: 'SN-SKT-LAV-S', stock: 13 },
      { size: 'M', color: 'Mint Green', material: 'Chiffon', sku: 'SN-SKT-MNT-M', stock: 10 },
    ],
  },

  // ─── ACCESSORIES (4 products) ──────────────────────────────────────────────
  {
    name: 'Structured Leather Crossbody Bag',
    slug: 'structured-leather-crossbody-bag',
    categorySlug: 'accessories',
    description: 'Full-grain Italian pebbled leather saddle bag with magnetic flap closure, interior card slots, and adjustable strap.',
    basePrice: 240,
    discountPrice: 195,
    ratingAvg: 4.9,
    ratingCount: 63,
    images: [
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 1,
    variants: [
      { size: 'M', color: 'Tan Leather', material: 'Pebbled Calfskin', sku: 'AC-BAG-TAN-M', stock: 15 },
      { size: 'M', color: 'Black Leather', material: 'Pebbled Calfskin', sku: 'AC-BAG-BLK-M', stock: 22 },
    ],
  },
  {
    name: 'Polarized Acetate Square Sunglasses',
    slug: 'polarized-acetate-square-sunglasses',
    categorySlug: 'accessories',
    description: 'Handcrafted Japanese acetate frames with 100% UV400 protection polarized lenses and 7-barrel hinges.',
    basePrice: 160,
    discountPrice: null,
    ratingAvg: 4.7,
    ratingCount: 41,
    images: [
      'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 17,
    variants: [
      { size: 'M', color: 'Tortoiseshell', material: 'Cellulose Acetate', sku: 'AC-SUN-TRT-M', stock: 25 },
      { size: 'M', color: 'Gloss Black', material: 'Cellulose Acetate', sku: 'AC-SUN-BLK-M', stock: 30 },
    ],
  },
  {
    name: 'Pure Silk Square Patterned Scarf',
    slug: 'pure-silk-square-patterned-scarf',
    categorySlug: 'accessories',
    description: '90x90cm hand-rolled edge silk twill scarf with vibrant equestrian art motif.',
    basePrice: 95,
    discountPrice: 75,
    ratingAvg: 4.8,
    ratingCount: 20,
    images: [
      'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 31,
    variants: [
      { size: 'M', color: 'Navy / Gold', material: '100% Silk Twill', sku: 'AC-SCF-NVY-M', stock: 12 },
      { size: 'M', color: 'Burgundy / Cream', material: '100% Silk Twill', sku: 'AC-SCF-BUR-M', stock: 16 },
    ],
  },
  {
    name: 'Classic Braided Leather Dress Belt',
    slug: 'classic-braided-leather-dress-belt',
    categorySlug: 'accessories',
    description: 'Hand-braided full-grain leather belt finished with polished solid brass buckle.',
    basePrice: 70,
    discountPrice: null,
    ratingAvg: 4.5,
    ratingCount: 15,
    images: [
      'https://images.unsplash.com/photo-1624222247344-550fb60583dc?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'active',
    daysAgoCreated: 48,
    variants: [
      { size: 'S', color: 'Cognac', material: 'Full Grain Leather', sku: 'AC-BLT-COG-S', stock: 14 },
      { size: 'M', color: 'Cognac', material: 'Full Grain Leather', sku: 'AC-BLT-COG-M', stock: 20 },
      { size: 'L', color: 'Dark Brown', material: 'Full Grain Leather', sku: 'AC-BLT-BRN-L', stock: 18 },
    ],
  },
];

export const seedProducts = async (): Promise<void> => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/shop';

  if (mongoose.connection.readyState === 0) {
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');
  }

  // Map category slugs to ObjectId
  const categories = await Category.find();
  const categoryMap = new Map<string, mongoose.Types.ObjectId>();
  categories.forEach((cat) => {
    categoryMap.set(cat.slug, cat._id as mongoose.Types.ObjectId);
  });

  console.log(`Found ${categories.length} categories in database.`);

  const now = new Date();

  // Clear existing products to ensure clean idempotent seed without duplicate keys
  console.log('Clearing existing products...');
  await Product.deleteMany({});

  console.log(`Seeding ${PRODUCTS_SEED_DATA.length} products across all categories...`);

  const productsToInsert = PRODUCTS_SEED_DATA.map((item) => {
    const categoryId = categoryMap.get(item.categorySlug);
    if (!categoryId) {
      throw new Error(`Category slug '${item.categorySlug}' not found in database. Seed categories first.`);
    }

    const createdDate = new Date(now.getTime() - item.daysAgoCreated * 24 * 60 * 60 * 1000);

    return {
      name: item.name,
      slug: item.slug,
      description: item.description,
      category: categoryId,
      images: item.images,
      basePrice: item.basePrice,
      discountPrice: item.discountPrice,
      ratingAvg: item.ratingAvg,
      ratingCount: item.ratingCount,
      variants: item.variants,
      status: item.status,
      createdAt: createdDate,
      updatedAt: createdDate,
    };
  });

  const insertedProducts = await Product.insertMany(productsToInsert);
  console.log(`Successfully seeded ${insertedProducts.length} products.`);

  // Validation metrics
  const totalCount = await Product.countDocuments();
  const discountedCount = await Product.countDocuments({ discountPrice: { $ne: null } });
  
  // Count products where all variants stock === 0
  const allProducts = await Product.find();
  const outOfStockCount = allProducts.filter((p) => !p.inStock).length;

  console.log('\n--- Seed Verification Metrics ---');
  console.log(`Total Products: ${totalCount}`);
  console.log(`Discounted Products (3+ required): ${discountedCount}`);
  console.log(`Out of Stock Products (2+ required): ${outOfStockCount}`);

  if (totalCount < 30) throw new Error('Expected at least 30 products seeded');
  if (discountedCount < 3) throw new Error('Expected at least 3 discounted products');
  if (outOfStockCount < 2) throw new Error('Expected at least 2 out of stock products');

  console.log('Product seed verification PASSED!');
};

if (require.main === module) {
  seedProducts()
    .then(async () => {
      console.log('Product seed finished successfully.');
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Error seeding products:', err);
      await mongoose.disconnect();
      process.exit(1);
    });
}
