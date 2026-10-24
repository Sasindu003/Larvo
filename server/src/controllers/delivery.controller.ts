import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { orderService } from '../services/order.service';
import {
  applyFieldPolicy,
  checkPiiRateLimit,
  getAccessedFullPiiFields,
} from '../utils/fieldAccess';
import { auditPiiRead } from '../services/audit.service';
import { ACTIVE_DELIVERY_STATUSES } from '../config/field-access';

/**
 * @desc    Get fulfillment queue orders for delivery manager / admin / owner
 * @route   GET /api/delivery/orders
 * @access  Private (delivery_manager, admin, owner)
 */
export const getDeliveryOrders = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  if (!(await checkPiiRateLimit(req, res))) {
    return;
  }

  const { page, limit, status, search } = req.query;
  const result = await orderService.getDeliveryOrders(req.user, {
    page: page as string,
    limit: limit as string,
    status: status as string,
    search: search as string,
  });

  const sanitizedOrders = (result.orders || []).map((o: any) =>
    applyFieldPolicy('Order', o, req.user!.role, { isOwner: false, status: o.status })
  );

  // If caller received any orders with full PII (active transit for delivery_manager or any for admin/owner), audit PII_READ
  const hasActiveTransit = sanitizedOrders.some((o: any) =>
    (ACTIVE_DELIVERY_STATUSES as readonly string[]).includes(o.status)
  );
  if (sanitizedOrders.length > 0 && (hasActiveTransit || req.user.role === 'admin' || req.user.role === 'owner')) {
    const fullPiiFields = getAccessedFullPiiFields(
      'Order',
      req.user.role,
      false,
      hasActiveTransit ? 'in_transit' : undefined
    );
    if (fullPiiFields.length > 0) {
      auditPiiRead(req, 'Order', null, fullPiiFields, req.user.role);
    }
  }

  res.status(200).json({
    success: true,
    data: {
      ...result,
      orders: sanitizedOrders,
    },
  });
});
