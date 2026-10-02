import mongoose, { Document, Schema, Types } from 'mongoose';

export type PointsTransactionType =
  | 'refund_earn'
  | 'order_spend'
  | 'admin_credit'
  | 'admin_debit'
  | 'reversal';

export type PointsTransactionDirection = 'credit' | 'debit';

export interface IPointsTransaction extends Document {
  wallet: Types.ObjectId;
  user: Types.ObjectId;
  type: PointsTransactionType;
  direction: PointsTransactionDirection;
  points: number;
  balanceAfter: number;
  order?: Types.ObjectId | null;
  returnRequest?: Types.ObjectId | null;
  idempotencyKey: string;
  note?: string | null;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const pointsTransactionSchema = new Schema<IPointsTransaction>(
  {
    wallet: {
      type: Schema.Types.ObjectId,
      ref: 'Wallet',
      required: [true, 'Wallet reference is required'],
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: ['refund_earn', 'order_spend', 'admin_credit', 'admin_debit', 'reversal'],
        message: 'Invalid points transaction type',
      },
      required: [true, 'Transaction type is required'],
    },
    direction: {
      type: String,
      enum: {
        values: ['credit', 'debit'],
        message: 'Direction must be credit or debit',
      },
      required: [true, 'Direction is required'],
    },
    points: {
      type: Number,
      required: [true, 'Points amount is required'],
      min: [1, 'Points must be at least 1'],
    },
    balanceAfter: {
      type: Number,
      required: [true, 'Balance after is required'],
      min: [0, 'Balance after cannot be negative'],
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    returnRequest: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    idempotencyKey: {
      type: String,
      required: [true, 'Idempotency key is required'],
      unique: true,
      trim: true,
    },
    note: {
      type: String,
      default: null,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Composite indexes
pointsTransactionSchema.index({ wallet: 1, createdAt: -1 });
pointsTransactionSchema.index({ type: 1, createdAt: -1 });

const PointsTransaction = mongoose.model<IPointsTransaction>(
  'PointsTransaction',
  pointsTransactionSchema
);

export { PointsTransaction };
export default PointsTransaction;
