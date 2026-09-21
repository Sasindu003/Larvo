import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IWallet extends Document {
  user: Types.ObjectId;
  balancePoints: number;
  lifetimeEarnedPoints: number;
  lifetimeSpentPoints: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const walletSchema = new Schema<IWallet>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
      index: true,
    },
    balancePoints: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Balance points cannot be negative'],
    },
    lifetimeEarnedPoints: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Lifetime earned points cannot be negative'],
    },
    lifetimeSpentPoints: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Lifetime spent points cannot be negative'],
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Wallet = mongoose.model<IWallet>('Wallet', walletSchema);

export { Wallet };
export default Wallet;
