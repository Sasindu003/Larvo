import mongoose, { Document, Schema, Types } from 'mongoose';

export type POStatus =
  | 'draft'
  | 'submitted'
  | 'quoted'
  | 'supplier_rejected'
  | 'confirmed'
  | 'in_transit'
  | 'partially_received'
  | 'received'
  | 'cancelled';

export const PO_STATUSES: POStatus[] = [
  'draft',
  'submitted',
  'quoted',
  'supplier_rejected',
  'confirmed',
  'in_transit',
  'partially_received',
  'received',
  'cancelled',
];

export const PO_VALID_TRANSITIONS: Record<POStatus, POStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['quoted', 'confirmed', 'supplier_rejected', 'cancelled'],
  quoted: ['confirmed', 'cancelled'],
  supplier_rejected: [],
  confirmed: ['in_transit', 'cancelled'],
  in_transit: ['partially_received', 'received'],
  partially_received: ['received'],
  received: [],
  cancelled: [],
};

export interface IPOItem {
  _id?: Types.ObjectId;
  product: Types.ObjectId;
  sku: string;
  size: string;
  color: string;
  orderedQty: number;
  quotedQty?: number;
  receivedQty: number;
  unitCost: number;
}

const poItemSchema = new Schema<IPOItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: [true, 'Product reference is required'] },
    sku: { type: String, required: [true, 'SKU is required'], trim: true },
    size: { type: String, required: [true, 'Size is required'], trim: true },
    color: { type: String, required: [true, 'Color is required'], trim: true },
    orderedQty: { type: Number, required: [true, 'Ordered quantity is required'], min: [1, 'Ordered quantity must be at least 1'] },
    quotedQty: { type: Number, default: 0, min: [0, 'Quoted quantity cannot be negative'] },
    receivedQty: { type: Number, default: 0, min: [0, 'Received quantity cannot be negative'] },
    unitCost: { type: Number, required: [true, 'Unit cost is required'], min: [0, 'Unit cost cannot be negative'] },
  },
  { _id: true }
);

export interface ISupplierFeedback {
  estimatedDeliveryDate?: Date | null;
  supplierNotes?: string;
  respondedAt?: Date | null;
  rejectionReason?: string;
}

export interface ITrackingInfo {
  carrier?: string;
  trackingNumber?: string;
  dispatchedAt?: Date | null;
}

export interface IPurchaseOrder extends Document {
  supplier: Types.ObjectId;
  items: IPOItem[];
  status: POStatus;
  expectedDeliveryDate?: Date | null;
  notes?: string;
  supplierFeedback?: ISupplierFeedback;
  cancelReason?: string;
  trackingInfo?: ITrackingInfo;
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
      default: 'draft',
      index: true,
    },
    expectedDeliveryDate: { type: Date, default: null },
    notes: { type: String, trim: true, default: '' },
    supplierFeedback: {
      estimatedDeliveryDate: { type: Date, default: null },
      supplierNotes: { type: String, trim: true, default: '' },
      respondedAt: { type: Date, default: null },
      rejectionReason: { type: String, trim: true, default: '' },
    },
    cancelReason: { type: String, trim: true, default: '' },
    trackingInfo: {
      carrier: { type: String, trim: true, default: '' },
      trackingNumber: { type: String, trim: true, default: '' },
      dispatchedAt: { type: Date, default: null },
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

purchaseOrderSchema.virtual('totalCost').get(function (this: IPurchaseOrder) {
  return (this.items || []).reduce((sum, item) => sum + item.orderedQty * item.unitCost, 0);
});

purchaseOrderSchema.index({ status: 1, createdAt: -1 });
purchaseOrderSchema.index({ supplier: 1, status: 1 });

export const PurchaseOrder = mongoose.model<IPurchaseOrder>('PurchaseOrder', purchaseOrderSchema);
export default PurchaseOrder;
