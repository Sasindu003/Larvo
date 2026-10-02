import mongoose, { Document, Schema, Types } from 'mongoose';

export type PaymentMethod = 'bank_transfer' | 'simulated_online' | 'reward_points';
export type PaymentStatus = 'submitted' | 'approved' | 'rejected';

export interface IPayment extends Document {
  order: Types.ObjectId;
  method: PaymentMethod;
  slipImageUrl?: string | null;
  transactionId?: string | null;
  maskedCardLast4?: string | null;
  gatewayResponseCode?: string | null;
  amount: number;
  status: PaymentStatus;
  pointsUsed?: number | null;
  walletTransaction?: Types.ObjectId | null;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  reviewNote?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
    },
    method: {
      type: String,
      enum: ['bank_transfer', 'simulated_online', 'reward_points'],
      required: true,
    },
    slipImageUrl: {
      type: String,
      default: null,
    },
    transactionId: {
      type: String,
      default: null,
    },
    maskedCardLast4: {
      type: String,
      default: null,
    },
    gatewayResponseCode: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['submitted', 'approved', 'rejected'],
      required: true,
    },
    pointsUsed: {
      type: Number,
      default: null,
      min: [0, 'Points used cannot be negative'],
    },
    walletTransaction: {
      type: Schema.Types.ObjectId,
      ref: 'PointsTransaction',
      default: null,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNote: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

paymentSchema.pre('validate', function (next) {
  if (this.method !== 'reward_points') {
    this.pointsUsed = null;
    this.walletTransaction = null;
  }
  next();
});

paymentSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() as any;
  if (update) {
    const method = update.method || update.$set?.method;
    if (method && method !== 'reward_points') {
      if (update.pointsUsed !== undefined) update.pointsUsed = null;
      if (update.walletTransaction !== undefined) update.walletTransaction = null;
      if (update.$set) {
        update.$set.pointsUsed = null;
        update.$set.walletTransaction = null;
      } else {
        update.pointsUsed = null;
        update.walletTransaction = null;
      }
    }
    this.setUpdate(update);
  }
  next();
});

paymentSchema.index({ status: 1, createdAt: -1 });

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
export default Payment;
