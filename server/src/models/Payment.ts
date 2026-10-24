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
    },
    transactionId: {
      type: String,
    },
    maskedCardLast4: {
      type: String,
    },
    gatewayResponseCode: {
      type: String,
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
      min: [0, 'Points used cannot be negative'],
    },
    walletTransaction: {
      type: Schema.Types.ObjectId,
      ref: 'PointsTransaction',
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    reviewNote: {
      type: String,
    },
  },
  { timestamps: true }
);

paymentSchema.pre('validate', function (next) {
  if (this.method !== 'reward_points') {
    this.pointsUsed = undefined;
    this.walletTransaction = undefined;
  }
  next();
});

paymentSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() as any;
  if (update) {
    const method = update.method || update.$set?.method;
    if (method && method !== 'reward_points') {
      if (update.pointsUsed !== undefined) delete update.pointsUsed;
      if (update.walletTransaction !== undefined) delete update.walletTransaction;
      if (update.$set) {
        delete update.$set.pointsUsed;
        delete update.$set.walletTransaction;
      }
      update.$unset = update.$unset || {};
      update.$unset.pointsUsed = 1;
      update.$unset.walletTransaction = 1;
    }
    this.setUpdate(update);
  }
  next();
});

paymentSchema.index({ status: 1, createdAt: -1 });

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
export default Payment;
