import mongoose, { Document, Schema, Types } from 'mongoose';

export type OrderStatus =
  | 'pending_payment'
  | 'payment_review'
  | 'confirmed'
  | 'processing'
  | 'ready_for_dispatch'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface IOrderItem {
  product: Types.ObjectId;
  name: string;
  image: string;
  variantSku: string;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
  lineTotal?: number;
}

export interface IAddressSnapshot {
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

export interface IOrder extends Document {
  user: Types.ObjectId;
  items: IOrderItem[];
  shippingAddress: IAddressSnapshot;
  couponCode?: string | null;
  discountAmount: number;
  subtotal: number;
  shippingFee: number;
  total: number;
  status: OrderStatus;
  trackingNumber?: string | null;
  deliveredAt?: Date | null;
  pointsPaid: number;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    variantSku: { type: String, required: true },
    size: { type: String, required: true },
    color: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number },
  },
  { _id: false, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

const addressSchema = new Schema<IAddressSnapshot>(
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

const orderSchema = new Schema<IOrder>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items: IOrderItem[]) => items.length > 0,
        message: 'Order must contain at least one item',
      },
    },
    shippingAddress: { type: addressSchema, required: true },
    couponCode: { type: String, default: null },
    discountAmount: { type: Number, default: 0, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: [
        'pending_payment',
        'payment_review',
        'confirmed',
        'processing',
        'ready_for_dispatch',
        'picked_up',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'cancelled',
      ],
      default: 'pending_payment',
    },
    trackingNumber: { type: String, default: null },
    deliveredAt: { type: Date, default: null },
    pointsPaid: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

orderSchema.virtual('discountTotal').get(function (this: IOrder) {
  return this.discountAmount ?? 0;
});

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

export const Order = mongoose.model<IOrder>('Order', orderSchema);
export default Order;
