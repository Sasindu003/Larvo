import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/error.middleware';
import { orderService } from '../services/order.service';

/**
 * @desc    Get fulfillment queue orders for delivery manager / admin / owner
 * @route   GET /api/delivery/orders
 * @access  Private (delivery_manager, admin, owner)
 */
export const getDeliveryOrders = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  const { page, limit, status, search } = req.query;
  const result = await orderService.getDeliveryOrders(req.user, {
    page: page as string,
    limit: limit as string,
    status: status as string,
    search: search as string,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});
