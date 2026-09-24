import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { Product } from './Product';

export type ReviewStatus = 'published' | 'hidden' | 'flagged';

export interface IAdminReply {
  text: string;
  repliedAt: Date;
  repliedBy: Types.ObjectId;
}

export interface IHelpfulVotes {
  up: Types.ObjectId[];
  down: Types.ObjectId[];
}

export interface IReview extends Document {
  product: Types.ObjectId;
  user: Types.ObjectId;
  order: Types.ObjectId;
  rating: number;
  title: string;
  comment: string;
  verifiedPurchase: boolean;
  status: ReviewStatus;
  photos: string[];
  helpfulVotes: IHelpfulVotes;
  adminReply?: IAdminReply | null;
  helpfulScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReviewModel extends Model<IReview> {
  calcAverageRating(productId: Types.ObjectId | string): Promise<void>;
}

const adminReplySchema = new Schema<IAdminReply>(
  {
    text: {
      type: String,
      required: [true, 'Reply text is required'],
      trim: true,
      maxlength: [2000, 'Reply cannot exceed 2000 characters'],
    },
    repliedAt: {
      type: Date,
      default: Date.now,
    },
    repliedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { _id: false }
);

const reviewSchema = new Schema<IReview, IReviewModel>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Delivered order reference is required'],
      index: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1 star'],
      max: [5, 'Rating cannot exceed 5 stars'],
    },
    title: {
      type: String,
      required: [true, 'Review title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    comment: {
      type: String,
      required: [true, 'Review comment is required'],
      trim: true,
      minlength: [5, 'Review comment must be at least 5 characters'],
      maxlength: [2000, 'Review comment cannot exceed 2000 characters'],
    },
    verifiedPurchase: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['published', 'hidden', 'flagged'],
      default: 'published',
      index: true,
    },
    photos: {
      type: [String],
      default: [],
      validate: {
        validator: (arr: string[]) => arr.length <= 5,
        message: 'Maximum 5 photos allowed per review',
      },
    },
    helpfulVotes: {
      up: {
        type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        default: [],
      },
      down: {
        type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        default: [],
      },
    },
    adminReply: {
      type: adminReplySchema,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: helpfulScore = upvotes - downvotes
reviewSchema.virtual('helpfulScore').get(function () {
  const up = this.helpfulVotes?.up?.length || 0;
  const down = this.helpfulVotes?.down?.length || 0;
  return up - down;
});

// Enforce one review per user per product
reviewSchema.index({ product: 1, user: 1 }, { unique: true });
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });

// Static method to recalculate ratingAvg and ratingCount on Product
reviewSchema.statics.calcAverageRating = async function (productId: Types.ObjectId | string): Promise<void> {
  const prodObjId = typeof productId === 'string' ? new Types.ObjectId(productId) : productId;

  const stats = await this.aggregate([
    {
      $match: {
        product: prodObjId,
        status: 'published',
      },
    },
    {
      $group: {
        _id: '$product',
        ratingAvg: { $avg: '$rating' },
        ratingCount: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    await Product.findByIdAndUpdate(prodObjId, {
      ratingAvg: Math.round(stats[0].ratingAvg * 10) / 10,
      ratingCount: stats[0].ratingCount,
    });
  } else {
    await Product.findByIdAndUpdate(prodObjId, {
      ratingAvg: 0,
      ratingCount: 0,
    });
  }
};

export const Review = mongoose.model<IReview, IReviewModel>('Review', reviewSchema);
export default Review;
