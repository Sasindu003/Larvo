import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import {
  getSupplierMe,
  getSupplierProducts,
  changeSupplierPassword,
  getSupplierPurchaseOrders,
  getSupplierPurchaseOrderById,
  submitSupplierQuote,
  declineSupplierPurchaseOrder,
  reviewPaymentSlip,
  markPurchaseOrderShipped,
} from '../controllers/supplier-portal.controller';

const router = Router();

// Gated by authentication and role (supplier, staff, admin, owner)
router.use(requireAuth);
router.use(requireRole('supplier', 'staff', 'admin', 'owner'));

router.get('/me', getSupplierMe);
router.get('/purchase-orders', getSupplierPurchaseOrders);
router.get('/purchase-orders/:id', getSupplierPurchaseOrderById);
router.patch(
  '/purchase-orders/:id/quote',
  requireRole('supplier', 'admin', 'owner'),
  submitSupplierQuote
);
router.patch(
  '/purchase-orders/:id/decline',
  requireRole('supplier', 'admin', 'owner'),
  declineSupplierPurchaseOrder
);
router.patch(
  '/purchase-orders/:id/review-payment',
  requireRole('supplier', 'admin', 'owner'),
  reviewPaymentSlip
);
router.patch(
  '/purchase-orders/:id/ship',
  requireRole('supplier', 'admin', 'owner'),
  markPurchaseOrderShipped
);
router.get('/products', getSupplierProducts);
router.patch('/change-password', changeSupplierPassword);

export default router;
