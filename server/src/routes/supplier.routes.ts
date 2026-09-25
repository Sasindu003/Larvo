import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import {
  getSupplierMe,
  getSupplierProducts,
  changeSupplierPassword,
} from '../controllers/supplier-portal.controller';

const router = Router();

// Gated by authentication and role (supplier, staff, admin, owner)
router.use(requireAuth);
router.use(requireRole('supplier', 'staff', 'admin', 'owner'));

router.get('/me', getSupplierMe);
router.get('/purchase-orders', (_req, res) => {
  res.status(200).json({
    success: true,
    data: { results: [], total: 0, page: 1, pages: 1 },
    message: 'Purchase orders cleared',
  });
});
router.get('/purchase-orders/:id', (_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Purchase orders feature is disabled',
  });
});
router.get('/products', getSupplierProducts);
router.patch('/change-password', changeSupplierPassword);

export default router;
