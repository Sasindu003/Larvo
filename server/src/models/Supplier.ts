import mongoose, { Document, Schema, Types } from 'mongoose';

export type SupplierStatus = 'active' | 'inactive';

export interface ISupplier extends Document {
  name: string;
  companyName: string;
  email: string;
  phone: string;
  address?: string;
  status: SupplierStatus;
  notes?: string;
  userId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const supplierSchema = new Schema<ISupplier>(
  {
    name: {
      type: String,
      required: [true, 'Contact person name is required'],
      trim: true,
    },
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Supplier email is required'],
      trim: true,
      lowercase: true,
      index: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      validate: {
        validator: (v: string) => /^\d{10,13}$/.test(v),
        message: 'Phone number must contain only numbers and be 10 to 13 digits long',
      },
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

supplierSchema.index({ companyName: 'text', name: 'text', email: 'text' });
supplierSchema.index({ status: 1, createdAt: -1 });

export const Supplier = mongoose.model<ISupplier>('Supplier', supplierSchema);
export default Supplier;
