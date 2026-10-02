import { Types } from 'mongoose';
import { Review, IReview, ReviewStatus } from '../models/Review';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { AppError } from '../middleware/error.middleware';
import { CreateReviewInput } from '../validators/review.validator';

export interface EligibilityResult {
  canReview: boolean;
  reason?: 'already_reviewed' | 'not_purchased' | 'not_delivered';
  orderId?: string;
  existingReview?: IReview | null;
  currentOrderStatus?: string;
}

export interface ReviewListResponse {
  items: any[];
  results: number;
  total: number;
  page: number;
  pages: number;
  ratingDistribution: Record<number, number>;
  photoGallery: { photoUrl: string; reviewId: string; rating: number; userName: string }[];
}

export interface AdminReviewListResponse {
  items: any[];
  results: number;
  total: number;
  page: number;
  pages: number;
}

export interface AdminReviewAnalytics {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  unansweredReviews: number;
  flaggedReviews: number;
  reviewsWithPhotos: number;
}

export class ReviewService {
  /**
   * Check if user is eligible to review the given product.
   * Requirement: User must have an order with status 'delivered' containing the product,
   * and must not have already submitted a review for it.
   */
  async checkReviewEligibility(
    userId: string | Types.ObjectId,
    productId: string | Types.ObjectId
  ): Promise<EligibilityResult> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const prodObjId = typeof productId === 'string' ? new Types.ObjectId(productId) : productId;

    // 1. Check if user already reviewed this product
    const existingReview = await Review.findOne({ product: prodObjId, user: userObjId });
    if (existingReview) {
      return {
        canReview: false,
        reason: 'already_reviewed',
        existingReview,
      };
    }

    // 2. Look for delivered order
    const deliveredOrder = await Order.findOne({
      user: userObjId,
      'items.product': prodObjId,
      status: 'delivered',
    }).sort({ deliveredAt: -1, createdAt: -1 });

    if (deliveredOrder) {
      return {
        canReview: true,
        orderId: deliveredOrder._id.toString(),
      };
    }

    // 3. If no delivered order, check if user has ANY order for this product
    const anyOrder = await Order.findOne({
      user: userObjId,
      'items.product': prodObjId,
    }).sort({ createdAt: -1 });

    if (!anyOrder) {
      return {
        canReview: false,
        reason: 'not_purchased',
      };
    }

    return {
      canReview: false,
      reason: 'not_delivered',
      currentOrderStatus: anyOrder.status,
    };
  }

  /**
   * Submit a new review.
   * Strictly enforces delivered order requirement.
   */
  async createReview(
    userId: string | Types.ObjectId,
    productId: string | Types.ObjectId,
    input: CreateReviewInput
  ): Promise<IReview> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const prodObjId = typeof productId === 'string' ? new Types.ObjectId(productId) : productId;

    // Verify product exists
    const product = await Product.findById(prodObjId);
    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Eligibility check
    const eligibility = await this.checkReviewEligibility(userObjId, prodObjId);
    if (!eligibility.canReview) {
      if (eligibility.reason === 'already_reviewed') {
        throw new AppError('You have already submitted a review for this product', 409);
      }
      if (eligibility.reason === 'not_delivered') {
        throw new AppError(
          'You can only review a product after receiving your order (status: delivered)',
          403
        );
      }
      throw new AppError(
        'You can only review a product that you have purchased and received',
        403
      );
    }

    const review = await Review.create({
      product: prodObjId,
      user: userObjId,
      order: new Types.ObjectId(eligibility.orderId),
      rating: input.rating,
      title: input.title,
      comment: input.comment,
      photos: input.photos || [],
      verifiedPurchase: true,
      status: 'published',
    });

    // Update product ratingAvg and ratingCount
    await Review.calcAverageRating(prodObjId);

    return review.populate('user', 'name');
  }

  /**
   * Public: Get paginated reviews for a product
   */
  async getProductReviews(
    productId: string | Types.ObjectId,
    query: {
      page?: number | string;
      limit?: number | string;
      sort?: string;
      withPhotos?: string | boolean;
      currentUserId?: string | Types.ObjectId;
    }
  ): Promise<ReviewListResponse> {
    const prodObjId = typeof productId === 'string' ? new Types.ObjectId(productId) : productId;
    const page = Math.max(1, parseInt(String(query.page || 1), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(query.limit || 10), 10)));
    const skip = (page - 1) * limit;

    const matchFilter: any = {
      product: prodObjId,
      status: 'published',
    };

    if (query.withPhotos === 'true' || query.withPhotos === true) {
      matchFilter['photos.0'] = { $exists: true };
    }

    // Determine sorting
    let sortStage: any = { createdAt: -1 };
    if (query.sort === 'helpful') {
      sortStage = { helpfulScore: -1, createdAt: -1 };
    } else if (query.sort === 'newest') {
      sortStage = { createdAt: -1 };
    } else if (query.sort === 'highest') {
      sortStage = { rating: -1, createdAt: -1 };
    } else if (query.sort === 'lowest') {
      sortStage = { rating: 1, createdAt: -1 };
    }

    // Pipeline with virtual calculation for helpfulScore
    const pipeline: any[] = [
      { $match: matchFilter },
      {
        $addFields: {
          helpfulScore: {
            $subtract: [
              { $size: { $ifNull: ['$helpfulVotes.up', []] } },
              { $size: { $ifNull: ['$helpfulVotes.down', []] } },
            ],
          },
          upvoteCount: { $size: { $ifNull: ['$helpfulVotes.up', []] } },
          downvoteCount: { $size: { $ifNull: ['$helpfulVotes.down', []] } },
        },
      },
      { $sort: sortStage },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'adminReply.repliedBy',
          foreignField: '_id',
          as: 'adminDetails',
        },
      },
      {
        $project: {
          _id: 1,
          product: 1,
          rating: 1,
          title: 1,
          comment: 1,
          verifiedPurchase: 1,
          photos: 1,
          helpfulVotes: 1,
          helpfulScore: 1,
          upvoteCount: 1,
          downvoteCount: 1,
          adminReply: {
            text: '$adminReply.text',
            repliedAt: '$adminReply.repliedAt',
            repliedBy: { $arrayElemAt: ['$adminDetails.name', 0] },
          },
          createdAt: 1,
          updatedAt: 1,
          user: {
            _id: { $arrayElemAt: ['$userDetails._id', 0] },
            name: { $arrayElemAt: ['$userDetails.name', 0] },
          },
        },
      },
    ];

    const [items, total] = await Promise.all([
      Review.aggregate(pipeline),
      Review.countDocuments(matchFilter),
    ]);

    // Attach user's current vote if logged in
    const currentUserIdStr = query.currentUserId ? query.currentUserId.toString() : null;
    const formattedItems = items.map((rev) => {
      let userVote: 'up' | 'down' | null = null;
      if (currentUserIdStr && rev.helpfulVotes) {
        const upArr = (rev.helpfulVotes.up || []).map((id: any) => id.toString());
        const downArr = (rev.helpfulVotes.down || []).map((id: any) => id.toString());
        if (upArr.includes(currentUserIdStr)) userVote = 'up';
        else if (downArr.includes(currentUserIdStr)) userVote = 'down';
      }
      return {
        ...rev,
        userVote,
      };
    });

    // Rating distribution for this product (1..5 stars)
    const ratingStats = await Review.aggregate([
      { $match: { product: prodObjId, status: 'published' } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]);

    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratingStats.forEach((stat) => {
      if (stat._id >= 1 && stat._id <= 5) {
        ratingDistribution[stat._id] = stat.count;
      }
    });

    // Top photo gallery strip (all photos across reviews for this product)
    const photoReviews = await Review.find(
      { product: prodObjId, status: 'published', 'photos.0': { $exists: true } },
      'photos rating user'
    )
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .limit(30);

    const photoGallery: { photoUrl: string; reviewId: string; rating: number; userName: string }[] = [];
    photoReviews.forEach((rev) => {
      const uName = (rev.user as any)?.name || 'Customer';
      rev.photos.forEach((p) => {
        photoGallery.push({
          photoUrl: p.startsWith('http') || p.startsWith('/api/files/') ? p : `/api/files/${p}`,
          reviewId: rev._id.toString(),
          rating: rev.rating,
          userName: uName,
        });
      });
    });

    return {
      items: formattedItems,
      results: formattedItems.length,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      ratingDistribution,
      photoGallery,
    };
  }

  /**
   * Cast a helpful or not helpful vote on a review.
   */
  async voteReview(
    reviewId: string,
    userId: string | Types.ObjectId,
    vote: 'up' | 'down' | 'remove'
  ): Promise<IReview> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const review = await Review.findById(reviewId);
    if (!review) {
      throw new AppError('Review not found', 404);
    }

    if (vote === 'up') {
      await Review.findByIdAndUpdate(reviewId, {
        $pull: { 'helpfulVotes.down': userObjId },
        $addToSet: { 'helpfulVotes.up': userObjId },
      });
    } else if (vote === 'down') {
      await Review.findByIdAndUpdate(reviewId, {
        $pull: { 'helpfulVotes.up': userObjId },
        $addToSet: { 'helpfulVotes.down': userObjId },
      });
    } else if (vote === 'remove') {
      await Review.findByIdAndUpdate(reviewId, {
        $pull: {
          'helpfulVotes.up': userObjId,
          'helpfulVotes.down': userObjId,
        },
      });
    }

    const updated = await Review.findById(reviewId);
    return updated!;
  }

  /**
   * Admin: Get filtered and paginated reviews
   */
  async getAdminReviews(query: {
    page?: number | string;
    limit?: number | string;
    q?: string;
    status?: string;
    rating?: number | string;
    replyStatus?: string;
    withPhotos?: string | boolean;
    productId?: string;
  }): Promise<AdminReviewListResponse> {
    const page = Math.max(1, parseInt(String(query.page || 1), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || 15), 10)));
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (query.status && ['published', 'hidden', 'flagged'].includes(query.status)) {
      filter.status = query.status;
    }

    if (query.rating) {
      const r = parseInt(String(query.rating), 10);
      if (r >= 1 && r <= 5) filter.rating = r;
    }

    if (query.replyStatus === 'replied') {
      filter['adminReply.text'] = { $exists: true, $ne: null };
    } else if (query.replyStatus === 'unreplied') {
      filter['adminReply.text'] = { $in: [null, undefined] };
    }

    if (query.withPhotos === 'true' || query.withPhotos === true) {
      filter['photos.0'] = { $exists: true };
    }

    if (query.productId) {
      filter.product = new Types.ObjectId(query.productId);
    }

    if (query.q && query.q.trim()) {
      const searchRegex = new RegExp(query.q.trim(), 'i');
      filter.$or = [{ title: searchRegex }, { comment: searchRegex }];
    }

    const [items, total] = await Promise.all([
      Review.find(filter)
        .populate('user', 'name email')
        .populate('product', 'name slug images')
        .populate('order', 'status createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments(filter),
    ]);

    return {
      items,
      results: items.length,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Admin: Get aggregate statistics for dashboard
   */
  async getAdminReviewAnalytics(): Promise<AdminReviewAnalytics> {
    const [totalReviews, unansweredReviews, flaggedReviews, reviewsWithPhotos, ratingStats] =
      await Promise.all([
        Review.countDocuments(),
        Review.countDocuments({ 'adminReply.text': { $in: [null, undefined] } }),
        Review.countDocuments({ status: 'flagged' }),
        Review.countDocuments({ 'photos.0': { $exists: true } }),
        Review.aggregate([
          {
            $group: {
              _id: '$rating',
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalScore = 0;
    ratingStats.forEach((stat) => {
      if (stat._id >= 1 && stat._id <= 5) {
        ratingDistribution[stat._id] = stat.count;
        totalScore += stat._id * stat.count;
      }
    });

    const averageRating = totalReviews > 0 ? Math.round((totalScore / totalReviews) * 10) / 10 : 0;

    return {
      totalReviews,
      averageRating,
      ratingDistribution,
      unansweredReviews,
      flaggedReviews,
      reviewsWithPhotos,
    };
  }

  /**
   * Admin: Add or update official reply
   */
  async replyToReview(
    reviewId: string,
    adminUserId: string | Types.ObjectId,
    text: string
  ): Promise<IReview> {
    const adminObjId = typeof adminUserId === 'string' ? new Types.ObjectId(adminUserId) : adminUserId;

    const review = await Review.findById(reviewId);
    if (!review) {
      throw new AppError('Review not found', 404);
    }

    review.adminReply = {
      text: text.trim(),
      repliedAt: new Date(),
      repliedBy: adminObjId,
    };

    await review.save();
    return review.populate([
      { path: 'user', select: 'name email' },
      { path: 'product', select: 'name slug images' },
    ]);
  }

  /**
   * Admin: Update status (published, hidden, flagged)
   */
  async updateReviewStatus(reviewId: string, status: ReviewStatus): Promise<IReview> {
    const review = await Review.findById(reviewId);
    if (!review) {
      throw new AppError('Review not found', 404);
    }

    review.status = status;
    await review.save();

    // Recalculate rating on product
    await Review.calcAverageRating(review.product);

    return review.populate([
      { path: 'user', select: 'name email' },
      { path: 'product', select: 'name slug images' },
    ]);
  }

  /**
   * Admin: Delete review permanently
   */
  async deleteReview(reviewId: string): Promise<void> {
    const review = await Review.findById(reviewId);
    if (!review) {
      throw new AppError('Review not found', 404);
    }

    const productId = review.product;
    await Review.findByIdAndDelete(reviewId);

    // Recalculate rating on product
    await Review.calcAverageRating(productId);
  }
}

export const reviewService = new ReviewService();
