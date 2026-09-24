import mongoose, { Document, Schema, Types } from 'mongoose';

// ── Variant Sub-document ───────────────────────────────────────────────────────

export const VALID_SIZES = ['XS', 'S', 'M', 'L', 'XL'] as const;
export type ProductSize = (typeof VALID_SIZES)[number];

export interface IVariant {
  size: ProductSize;
  color: string;
  material: string;
  sku: string;
  stock: number;
  supplier?: Types.ObjectId | null;
}

const variantSchema = new Schema<IVariant>(
  {
    size: {
      type: String,
      required: [true, 'Variant size is required'],
      enum: {
        values: VALID_SIZES as unknown as string[],
        message: 'Size must be one of: XS, S, M, L, XL',
      },
    },
    color: {
      type: String,
      required: [true, 'Variant color is required'],
      trim: true,
    },
    material: {
      type: String,
      required: [true, 'Variant material is required'],
      trim: true,
    },
    sku: {
      type: String,
      required: [true, 'Variant SKU is required'],
      trim: true,
    },
    stock: {
      type: Number,
      required: [true, 'Variant stock is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    supplier: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null,
    },
  },
  { _id: true }
);

// ── Product Document Interface ─────────────────────────────────────────────────

export type ProductStatus = 'active' | 'draft' | 'archived';

export interface IProduct extends Document {
  name: string;
  slug: string;
  description: string;
  category: Types.ObjectId;
  images: string[];
  basePrice: number;
  discountPrice: number | null;
  ratingAvg: number;
  ratingCount: number;
  variants: IVariant[];
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
  /** Virtual: true if any variant has stock > 0 */
  inStock: boolean;
}

// ── Product Schema ─────────────────────────────────────────────────────────────

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Product slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Product category is required'],
      index: true,
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (arr: string[]) => arr.length > 0,
        message: 'Product must have at least one image',
      },
    },
    basePrice: {
      type: Number,
      required: [true, 'Base price is required'],
      min: [0, 'Base price cannot be negative'],
    },
    discountPrice: {
      type: Number,
      default: null,
      min: [0, 'Discount price cannot be negative'],
      validate: {
        validator(this: any, val: number | null) {
          if (val === null || val === undefined) return true;
          let basePrice = this?.basePrice;
          if (basePrice === undefined && this && typeof this.getUpdate === 'function') {
            const update = this.getUpdate();
            basePrice = update?.$set?.basePrice ?? update?.basePrice;
          }
          if (basePrice !== undefined && basePrice !== null) {
            return val < basePrice;
          }
          return true;
        },
        message: 'Discount price must be less than the base price',
      },
    },
    ratingAvg: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be below 0'],
      max: [5, 'Rating cannot exceed 5'],
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: [0, 'Rating count cannot be negative'],
    },
    variants: {
      type: [variantSchema],
      default: [],
      validate: {
        validator: (arr: IVariant[]) => arr.length > 0,
        message: 'Product must have at least one variant',
      },
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'draft', 'archived'] as const,
        message: 'Status must be one of: active, draft, archived',
      },
      default: 'draft',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Computed Virtual ───────────────────────────────────────────────────────────

productSchema.virtual('inStock').get(function (this: IProduct) {
  if (!Array.isArray(this.variants)) return true;
  return this.variants.some((v) => v.stock > 0);
});

// ── Indexes ────────────────────────────────────────────────────────────────────

// Compound index for catalog listing queries (category + status)
productSchema.index({ category: 1, status: 1 });

// Text index for full-text search (P14)
productSchema.index(
  { name: 'text', description: 'text' },
  { weights: { name: 10, description: 5 }, name: 'product_text_search' }
);

// Enforce unique SKUs globally across all product variants
productSchema.index({ 'variants.sku': 1 }, { unique: true, sparse: true, name: 'sku_global_unique' });

// Index variants.supplier for supplier product queries & referential integrity checks (P60)
productSchema.index({ 'variants.supplier': 1 });

// ── Model Export ───────────────────────────────────────────────────────────────

export const Product = mongoose.model<IProduct>('Product', productSchema);
