import mongoose, { Document, Schema } from 'mongoose';

export interface IDepartment extends Document {
  name: string;
  slug: string;
  image: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const departmentSchema = new Schema<IDepartment>(
  {
    name:   { type: String, required: true, trim: true },
    slug:   { type: String, required: true, unique: true, lowercase: true },
    image:  { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

departmentSchema.index({ active: 1 });

export const Department = mongoose.model<IDepartment>('Department', departmentSchema);
export default Department;

