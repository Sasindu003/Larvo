import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { uploadSlip, handleMulterError } from '../middleware/upload.middleware';
import {
  createOrder,
  payOrderWithWallet,
  uploadPaymentSlip,
  simulatePayment,
  updateOrderStatus,
  getMyOrders,
  getOrderById,
  cancelMyOrder,
  getAdminOrders,
  updateOrderTracking,
} from '../controllers/order.controller';

const router = Router();

// All order endpoints require authentication
router.use(requireAuth);

router.post('/', createOrder);
router.get('/', requireRole('staff', 'admin', 'owner'), getAdminOrders);
router.get('/me', getMyOrders);
router.get('/:orderId', getOrderById);
router.patch('/:orderId/cancel', cancelMyOrder);
router.post('/:orderId/payment/wallet', payOrderWithWallet);
router.post('/:orderId/payment/slip', uploadSlip, handleMulterError, uploadPaymentSlip);
router.post('/:orderId/payment/simulate', simulatePayment);
router.patch(
  '/:orderId/status',
  requireRole('customer', 'staff', 'admin', 'owner', 'delivery_manager'),
  updateOrderStatus
);
router.patch(
  '/:orderId/tracking',
  requireRole('delivery_manager', 'admin', 'owner'),
  updateOrderTracking
);

export default router;


