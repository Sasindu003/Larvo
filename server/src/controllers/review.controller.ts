import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/error.middleware';
import { reviewService } from '../services/review.service';
import {
  CreateReviewSchema,
  AdminReplySchema,
  UpdateReviewStatusSchema,
  VoteReviewSchema,
} from '../validators/review.validator';

/**
 * @desc    Check review eligibility for current user on a product
 * @route   GET /api/reviews/product/:productId/eligibility
 * @access  Private (Customer)
 */
export const checkEligibility = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  const { productId } = req.params;
  const result = await reviewService.checkReviewEligibility(req.user._id, productId);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Submit a review for a product (strictly requires delivered order)
 * @route   POST /api/reviews/product/:productId
 * @access  Private (Customer)
 */
export const createReview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  let parsed;
  try {
    parsed = CreateReviewSchema.parse(req.body);
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Validation failed', 422, errors);
    }
    throw err;
  }

  const { productId } = req.params;
  const review = await reviewService.createReview(req.user._id, productId, parsed);

  res.status(201).json({
    success: true,
    data: review,
    message: 'Thank you for your review!',
  });
});

/**
 * @desc    Get published reviews for a product with ratings and photo strip
 * @route   GET /api/reviews/product/:productId
 * @access  Public (supports optionalAuth for voting status)
 */
export const getProductReviews = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;
  const result = await reviewService.getProductReviews(productId, {
    ...req.query,
    currentUserId: req.user?._id,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Vote helpful or not helpful on a review
 * @route   PATCH /api/reviews/:id/vote
 * @access  Private (Authenticated)
 */
export const voteReview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  let parsed;
  try {
    parsed = VoteReviewSchema.parse(req.body);
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Validation failed', 422, errors);
    }
    throw err;
  }

  const { id } = req.params;
  const review = await reviewService.voteReview(id, req.user._id, parsed.vote);

  res.status(200).json({
    success: true,
    data: review,
    message: 'Feedback recorded',
  });
});

/**
 * @desc    Get reviews list for admin moderation
 * @route   GET /api/reviews/admin
 * @access  Private (Staff/Admin/Owner)
 */
export const getAdminReviews = asyncHandler(async (req: Request, res: Response) => {
  const result = await reviewService.getAdminReviews(req.query);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get review analytics for admin panel
 * @route   GET /api/reviews/admin/analytics
 * @access  Private (Staff/Admin/Owner)
 */
export const getAdminReviewAnalytics = asyncHandler(async (_req: Request, res: Response) => {
  const analytics = await reviewService.getAdminReviewAnalytics();

  res.status(200).json({
    success: true,
    data: analytics,
  });
});

/**
 * @desc    Post or update an official admin reply
 * @route   POST /api/reviews/admin/:id/reply
 * @access  Private (Staff/Admin/Owner)
 */
export const replyToReview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  let parsed;
  try {
    parsed = AdminReplySchema.parse(req.body);
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Validation failed', 422, errors);
    }
    throw err;
  }

  const { id } = req.params;
  const review = await reviewService.replyToReview(id, req.user._id, parsed.text);

  res.status(200).json({
    success: true,
    data: review,
    message: 'Reply posted successfully',
  });
});

/**
 * @desc    Update review status (published, hidden, flagged)
 * @route   PATCH /api/reviews/admin/:id/status
 * @access  Private (Staff/Admin/Owner)
 */
export const updateReviewStatus = asyncHandler(async (req: Request, res: Response) => {
  let parsed;
  try {
    parsed = UpdateReviewStatusSchema.parse(req.body);
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Validation failed', 422, errors);
    }
    throw err;
  }

  const { id } = req.params;
  const review = await reviewService.updateReviewStatus(id, parsed.status);

  res.status(200).json({
    success: true,
    data: review,
    message: `Review status changed to ${parsed.status}`,
  });
});

/**
 * @desc    Delete a review permanently
 * @route   DELETE /api/reviews/admin/:id
 * @access  Private (Admin/Owner)
 */
export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await reviewService.deleteReview(id);

  res.status(200).json({
    success: true,
    message: 'Review deleted successfully',
  });
});
