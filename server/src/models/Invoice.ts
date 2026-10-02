import mongoose, { Document, Schema, Types } from 'mongoose';
import { IOrderItem, IAddressSnapshot } from './Order';
import { PaymentMethod, PaymentStatus } from './Payment';

export interface IInvoiceSnapshot {
  items: IOrderItem[];
  shippingAddress: IAddressSnapshot;
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  total: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  pointsUsed?: number | null;
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  order: Types.ObjectId;
  user: Types.ObjectId;
  snapshot: IInvoiceSnapshot;
  issuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export function deriveInvoiceNumber(orderId: Types.ObjectId | string): string {
  const str = typeof orderId === 'string' ? orderId : orderId.toString();
  return `INV-${str.slice(-8).toUpperCase()}`;
}

const invoiceItemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    variantSku: { type: String, required: true },
    size: { type: String, required: true },
    color: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const invoiceAddressSchema = new Schema<IAddressSnapshot>(
  {
    label: { type: String },
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    province: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
  },
  { _id: false }
);

const invoiceSnapshotSchema = new Schema<IInvoiceSnapshot>(
  {
    items: { type: [invoiceItemSchema], required: true },
    shippingAddress: { type: invoiceAddressSchema, required: true },
    subtotal: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, required: true, default: 0, min: 0 },
    shippingFee: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, required: true },
    paymentMethod: { type: String, required: true },
    pointsUsed: { type: Number, default: null },
  },
  { _id: false }
);

const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    snapshot: {
      type: invoiceSnapshotSchema,
      required: true,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { timestamps: true }
);

invoiceSchema.index({ user: 1, createdAt: -1 });

export const Invoice = mongoose.model<IInvoice>('Invoice', invoiceSchema);
export default Invoice;
