import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { getDeliveryOrders } from '../controllers/delivery.controller';
import { updateOrderTracking } from '../controllers/order.controller';
import {
  getDeliveryReturns,
  advanceReturnStatus,
} from '../controllers/return.controller';

const router = Router();

// All delivery portal routes require auth + delivery role
router.use(requireAuth);
router.use(requireRole('delivery_manager', 'admin', 'owner'));

/**
 * @desc    Get fulfillment-stage orders queue
 * @route   GET /api/delivery/orders
 * @access  Private (delivery_manager, admin, owner)
 */
router.get('/orders', getDeliveryOrders);

/**
 * @desc    Convenience alias to update tracking directly within delivery scope
 * @route   PATCH /api/delivery/orders/:orderId/tracking
 * @access  Private (delivery_manager, admin, owner)
 */
router.patch('/orders/:orderId/tracking', updateOrderTracking);

/**
 * @desc    Get return pickup queue for delivery manager
 * @route   GET /api/delivery/returns
 * @access  Private (delivery_manager, admin, owner)
 */
router.get('/returns', getDeliveryReturns);

/**
 * @desc    Advance return pickup status (picked_up -> received)
 * @route   PATCH /api/delivery/returns/:id/status
 * @access  Private (delivery_manager, admin, owner)
 */
router.patch('/returns/:id/status', advanceReturnStatus);

export default router;
