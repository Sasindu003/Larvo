import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { uploadSlip, handleMulterError } from '../middleware/upload.middleware';
import { transactionRateLimit } from '../middleware/rateLimiters';
import { noStore } from '../middleware/noStore';
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

// All order endpoints require authentication and must not be cached
router.use(noStore);
router.use(requireAuth);

router.post('/', transactionRateLimit, createOrder);
router.get('/', requireRole('staff', 'admin', 'owner'), getAdminOrders);
router.get('/me', getMyOrders);
router.get('/:orderId', getOrderById);
router.patch('/:orderId/cancel', cancelMyOrder);
router.post('/:orderId/payment/wallet', transactionRateLimit, payOrderWithWallet);
router.post('/:orderId/payment/slip', transactionRateLimit, uploadSlip, handleMulterError, uploadPaymentSlip);
router.post('/:orderId/payment/simulate', transactionRateLimit, simulatePayment);
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


