import mongoose, { Document, Schema, Types } from 'mongoose';

export type POStatus =
  | 'requested'
  | 'quoted'
  | 'declined'
  | 'admin_approved'
  | 'admin_rejected'
  | 'payment_submitted'
  | 'payment_rejected'
  | 'confirmed'
  | 'in_transit'
  | 'partially_received'
  | 'received'
  | 'cancelled';

export const PO_STATUSES: POStatus[] = [
  'requested',
  'quoted',
  'declined',
  'admin_approved',
  'admin_rejected',
  'payment_submitted',
  'payment_rejected',
  'confirmed',
  'in_transit',
  'partially_received',
  'received',
  'cancelled',
];

export const PO_VALID_TRANSITIONS: Record<POStatus, POStatus[]> = {
  requested: ['quoted', 'declined', 'cancelled'],
  quoted: ['admin_approved', 'admin_rejected'],
  admin_approved: ['payment_submitted', 'cancelled'],
  admin_rejected: ['cancelled'],
  payment_submitted: ['confirmed', 'payment_rejected'],
  payment_rejected: ['payment_submitted', 'cancelled'],
  confirmed: ['in_transit', 'cancelled'],
  in_transit: ['partially_received', 'received'],
  partially_received: ['received'],
  received: [],
  declined: [],
  cancelled: [],
};

export interface IPOItem {
  _id?: Types.ObjectId;
  product: Types.ObjectId;
  sku: string;
  size: string;
  color: string;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
  quotedQty: number;
  quotedUnitCost: number;
}

const poItemSchema = new Schema<IPOItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: [true, 'Product reference is required'] },
    sku: { type: String, required: [true, 'SKU is required'], trim: true },
    size: { type: String, required: [true, 'Size is required'], trim: true },
    color: { type: String, required: [true, 'Color is required'], trim: true },
    orderedQty: { type: Number, required: [true, 'Ordered quantity is required'], min: [1, 'Ordered quantity must be at least 1'] },
    receivedQty: { type: Number, default: 0, min: [0, 'Received quantity cannot be negative'] },
    unitCost: { type: Number, default: 0, min: [0, 'Unit cost cannot be negative'] },
    quotedQty: { type: Number, default: 0, min: [0, 'Quoted quantity cannot be negative'] },
    quotedUnitCost: { type: Number, default: 0, min: [0, 'Quoted unit cost cannot be negative'] },
  },
  { _id: true }
);

export interface IPurchaseOrder extends Document {
  supplier: Types.ObjectId;
  items: IPOItem[];
  status: POStatus;
  estimatedDeliveryDate?: Date | null;
  paymentSlipUrl?: string | null;
  paymentReviewNote?: string | null;
  declineReason?: string | null;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  totalCost: number;
}

const purchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: [true, 'Supplier is required'], index: true },
    items: {
      type: [poItemSchema],
      validate: { validator: (arr: IPOItem[]) => arr.length > 0, message: 'Purchase order must have at least one item' },
    },
    status: {
      type: String,
      enum: { values: PO_STATUSES, message: `Status must be one of: ${PO_STATUSES.join(', ')}` },
      default: 'requested',
      index: true,
    },
    estimatedDeliveryDate: { type: Date, default: null },
    paymentSlipUrl: { type: String, default: null },
    paymentReviewNote: { type: String, default: null },
    declineReason: { type: String, default: null },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

const PRE_QUOTE_STATUSES: POStatus[] = ['requested', 'admin_rejected'];

purchaseOrderSchema.virtual('totalCost').get(function (this: IPurchaseOrder) {
  const useOriginal = PRE_QUOTE_STATUSES.includes(this.status);
  return (this.items || []).reduce((sum, item) => {
    return (
      sum +
      (useOriginal
        ? (item.orderedQty || 0) * (item.unitCost || 0)
        : (item.quotedQty || 0) * (item.quotedUnitCost || 0))
    );
  }, 0);
});

purchaseOrderSchema.index({ status: 1, createdAt: -1 });
purchaseOrderSchema.index({ supplier: 1, status: 1 });

export const PurchaseOrder = mongoose.model<IPurchaseOrder>('PurchaseOrder', purchaseOrderSchema);
export default PurchaseOrder;
