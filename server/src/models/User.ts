import mongoose, { Document, Schema, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'customer' | 'staff' | 'admin' | 'owner' | 'delivery_manager';

export interface IAddress {
  _id?: Types.ObjectId;
  label: string;        // e.g. "Home", "Office"
  line1: string;
  line2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault: boolean;
}

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash?: string;
  role: UserRole;
  addresses: IAddress[];
  wishlist: Types.ObjectId[];
  googleId?: string | null;
  authProvider: 'local' | 'google';
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const AddressSchema = new Schema<IAddress>(
  {
    label:      { type: String, default: 'Home' },
    line1:      { type: String, required: true },
    line2:      { type: String },
    city:       { type: String, required: true },
    province:   { type: String, required: true },
    postalCode: { type: String, required: true },
    country:    { type: String, required: true, default: 'Thailand' },
    phone:      {
      type: String,
      trim: true,
      validate: {
        validator: (v: string) => !v || /^\d{10,13}$/.test(v),
        message: 'Phone number must contain only numbers and be 10 to 13 digits long',
      },
    },
    isDefault:  { type: Boolean, default: false },
  },
  { _id: true }
);

const UserSchema = new Schema<IUser>(
  {
    name:         { type: String, required: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: false, select: false },
    googleId: { type: String, default: undefined, sparse: true, unique: true },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    active: { type: Boolean, default: true, index: true },
    role: {
      type:    String,
      enum:    ['customer', 'staff', 'admin', 'owner', 'delivery_manager'],
      default: 'customer',
    },
    addresses: { type: [AddressSchema], default: [] },
    wishlist:  [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  },
  { timestamps: true }
);

// ── Pre-save: hash password only when it is new/modified ────────────────────
UserSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('passwordHash') || !this.passwordHash) return next();
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

// ── Instance method: compare candidate password ──────────────────────────────
UserSchema.methods.comparePassword = function (
  this: IUser,
  candidate: string
): Promise<boolean> {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.passwordHash);
};

// Ensure passwordHash is never returned in JSON responses
UserSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as any).passwordHash;
    return ret;
  },
});

const User = mongoose.model<IUser>('User', UserSchema);
export { User };
export default User;
