import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import { Product } from '../models/Product';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/error.middleware';

/**
 * @desc    Get current user's populated wishlist
 * @route   GET /api/wishlist
 * @access  Authenticated
 */
export const getWishlist = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  const user = await User.findById(userId).populate({
    path: 'wishlist',
    match: { status: 'active' },
    populate: { path: 'category', select: 'name slug image' },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Filter out any null entries (e.g. if product was inactive or deleted)
  const wishlist = (user.wishlist || []).filter(Boolean);

  res.status(200).json({
    success: true,
    data: { wishlist },
  });
});

/**
 * @desc    Toggle product in wishlist (adds if not present, removes if present)
 * @route   POST /api/wishlist/:productId
 * @access  Authenticated
 */
export const toggleWishlist = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;
  const userId = req.user?._id;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new AppError('Invalid product ID', 400);
  }

  const product = await Product.findById(productId);
  if (!product || product.status !== 'active') {
    throw new AppError('Product not found or unavailable', 404);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const currentWishlist = user.wishlist.map((id) => id.toString());
  const isAlreadyWishlisted = currentWishlist.includes(productId);

  let updatedUser;
  let action: 'added' | 'removed';

  if (isAlreadyWishlisted) {
    // Remove from wishlist
    updatedUser = await User.findByIdAndUpdate(
      userId,
      { $pull: { wishlist: new mongoose.Types.ObjectId(productId) } },
      { new: true }
    );
    action = 'removed';
  } else {
    // Add to wishlist (guaranteed no duplicates with $addToSet)
    updatedUser = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { wishlist: new mongoose.Types.ObjectId(productId) } },
      { new: true }
    );
    action = 'added';
  }

  res.status(200).json({
    success: true,
    message: action === 'added' ? 'Product added to wishlist' : 'Product removed from wishlist',
    data: {
      wishlist: updatedUser?.wishlist || [],
      isWishlisted: action === 'added',
      action,
    },
  });
});

/**
 * @desc    Explicitly remove product from wishlist
 * @route   DELETE /api/wishlist/:productId
 * @access  Authenticated
 */
export const removeFromWishlist = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;
  const userId = req.user?._id;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new AppError('Invalid product ID', 400);
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $pull: { wishlist: new mongoose.Types.ObjectId(productId) } },
    { new: true }
  );

  if (!updatedUser) {
    throw new AppError('User not found', 404);
  }

  res.status(200).json({
    success: true,
    message: 'Product removed from wishlist',
    data: {
      wishlist: updatedUser.wishlist || [],
      isWishlisted: false,
    },
  });
});
