import mongoose, { Document, Schema, Types } from 'mongoose';

export type ReturnStatus =
  | 'requested'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'pickup_scheduled'
  | 'picked_up'
  | 'received'
  | 'refunded';

export interface IReturnItem {
  orderItemRef: number;
  sku: string;
  qty: number;
  reason: string;
}

export interface IReturnRequest extends Document {
  order: Types.ObjectId;
  user: Types.ObjectId;
  items: IReturnItem[];
  status: ReturnStatus;
  rejectionReason: string | null;
  estimatedRefundPoints?: number | null;
  refundPoints: number | null;
  refundMethod: 'wallet_points' | null;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const returnItemSchema = new Schema<IReturnItem>(
  {
    orderItemRef: { type: Number, required: true, min: 0 },
    sku: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const returnRequestSchema = new Schema<IReturnRequest>(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: {
      type: [returnItemSchema],
      required: true,
      validate: {
        validator: (items: IReturnItem[]) => Array.isArray(items) && items.length > 0,
        message: 'Return request must contain at least one item',
      },
    },
    status: {
      type: String,
      enum: [
        'requested',
        'under_review',
        'approved',
        'rejected',
        'pickup_scheduled',
        'picked_up',
        'received',
        'refunded',
      ],
      default: 'requested',
      required: true,
    },
    rejectionReason: { type: String, default: null },
    estimatedRefundPoints: { type: Number, default: null },
    refundPoints: { type: Number, default: null },
    refundMethod: { type: String, enum: ['wallet_points', null], default: null },
    refundedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

returnRequestSchema.index({ order: 1 });
returnRequestSchema.index({ user: 1, createdAt: -1 });
returnRequestSchema.index({ order: 1, status: 1 });

export const ReturnRequest = mongoose.model<IReturnRequest>('ReturnRequest', returnRequestSchema);
export default ReturnRequest;
