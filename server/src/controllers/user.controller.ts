import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import User from '../models/User';
import { AppError } from '../middleware/error.middleware';

/**
 * @desc    Update user profile (name only)
 * @route   PATCH /api/users/me
 * @access  Private
 */
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body;

  if (!name) {
    throw new AppError('Please provide a name', 400);
  }

  const user = await User.findById(req.user!._id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  user.name = name;
  await user.save();

  res.status(200).json({
    success: true,
    data: user,
    message: 'Profile updated successfully',
  });
});

/**
 * @desc    Update user password
 * @route   PATCH /api/users/me/password
 * @access  Private
 */
export const updatePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError('Please provide current and new password', 400);
  }

  // Need to explicitly select passwordHash as it is select: false
  const user = await User.findById(req.user!._id).select('+passwordHash');
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Check if current password is correct
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new AppError('Incorrect current password', 401);
  }

  user.passwordHash = newPassword;
  await user.save();

  // Send back user without passwordHash
  const updatedUser = await User.findById(req.user!._id);

  res.status(200).json({
    success: true,
    data: updatedUser,
    message: 'Password updated successfully',
  });
});

/**
 * @desc    Add a new address
 * @route   POST /api/users/me/addresses
 * @access  Private
 */
export const addAddress = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!._id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const { isDefault, ...addressData } = req.body;
  const isFirstAddress = user.addresses.length === 0;
  const shouldBeDefault = isDefault || isFirstAddress;

  // If this new one is default, unset any existing defaults
  if (shouldBeDefault) {
    user.addresses.forEach((addr) => {
      addr.isDefault = false;
    });
  }

  const newAddress = {
    ...addressData,
    isDefault: shouldBeDefault,
  };

  user.addresses.push(newAddress as any);
  await user.save();

  res.status(201).json({
    success: true,
    data: user.addresses,
    message: 'Address added successfully',
  });
});

/**
 * @desc    Update an existing address
 * @route   PATCH /api/users/me/addresses/:id
 * @access  Private
 */
export const updateAddress = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!._id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const addressId = req.params.id;
  const addressIndex = user.addresses.findIndex((addr) => addr._id?.toString() === addressId);

  if (addressIndex === -1) {
    throw new AppError('Address not found', 404);
  }

  const { isDefault, _id, ...updateData } = req.body;

  // If setting this one to default, unset all others
  if (isDefault) {
    user.addresses.forEach((addr, idx) => {
      if (idx !== addressIndex) {
        addr.isDefault = false;
      }
    });
    user.addresses[addressIndex].isDefault = true;
  } else if (isDefault === false && user.addresses[addressIndex].isDefault) {
     // cannot unset default address directly if it's the only one
     if (user.addresses.length === 1) {
        user.addresses[addressIndex].isDefault = true; // force it to stay default
     } else {
        user.addresses[addressIndex].isDefault = false;
        // make the first other address the default
        const nextDefault = user.addresses.find(addr => addr._id?.toString() !== addressId);
        if (nextDefault) nextDefault.isDefault = true;
     }
  }

  // Update fields
  Object.assign(user.addresses[addressIndex], updateData);

  await user.save();

  res.status(200).json({
    success: true,
    data: user.addresses,
    message: 'Address updated successfully',
  });
});

/**
 * @desc    Delete an address
 * @route   DELETE /api/users/me/addresses/:id
 * @access  Private
 */
export const deleteAddress = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!._id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const addressId = req.params.id;
  const addressIndex = user.addresses.findIndex((addr) => addr._id?.toString() === addressId);

  if (addressIndex === -1) {
    throw new AppError('Address not found', 404);
  }

  const wasDefault = user.addresses[addressIndex].isDefault;
  
  // Remove the address
  user.addresses.splice(addressIndex, 1);

  // If we deleted the default address and there are remaining addresses,
  // make the first remaining address the new default.
  if (wasDefault && user.addresses.length > 0) {
    user.addresses[0].isDefault = true;
  }

  await user.save();

  res.status(200).json({
    success: true,
    data: user.addresses,
    message: 'Address deleted successfully',
  });
});
