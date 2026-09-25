import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  advancePurchaseOrderStatus,
  cancelPurchaseOrder,
  receivePurchaseOrder,
  decideQuote,
} from '../controllers/purchase-order.controller';

const router = Router();

// All purchase order operations require authentication
router.use(requireAuth);

router.get('/', requireRole('admin', 'owner'), getPurchaseOrders);
router.post('/', requireRole('admin', 'owner'), createPurchaseOrder);
router.get('/:id', requireRole('admin', 'owner'), getPurchaseOrderById);
router.patch('/:id/status', requireRole('admin', 'owner'), advancePurchaseOrderStatus);
router.patch('/:id/decide-quote', requireRole('admin', 'owner'), decideQuote);
router.patch('/:id/cancel', requireRole('admin', 'owner'), cancelPurchaseOrder);
router.patch('/:id/receive', requireRole('admin', 'owner', 'staff'), receivePurchaseOrder);
router.patch('/:id', requireRole('admin', 'owner'), updatePurchaseOrder);

export default router;
