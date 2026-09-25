import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import {
  getSupplierMe,
  getSupplierPurchaseOrders,
  getSupplierPurchaseOrderById,
  getSupplierProducts,
  changeSupplierPassword,
  respondToSupplierPurchaseOrder,
  dispatchSupplierPurchaseOrder,
} from '../controllers/supplier-portal.controller';

const router = Router();

// Gated by authentication and role (supplier, staff, admin, owner)
router.use(requireAuth);
router.use(requireRole('supplier', 'staff', 'admin', 'owner'));

router.get('/me', getSupplierMe);
router.get('/purchase-orders', getSupplierPurchaseOrders);
router.get('/purchase-orders/:id', getSupplierPurchaseOrderById);
router.patch('/purchase-orders/:id/respond', respondToSupplierPurchaseOrder);
router.patch('/purchase-orders/:id/dispatch', dispatchSupplierPurchaseOrder);
router.get('/products', getSupplierProducts);
router.patch('/change-password', changeSupplierPassword);

export default router;
