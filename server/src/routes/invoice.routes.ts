import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getInvoiceByOrderId, getInvoicePdf } from '../controllers/invoice.controller';

const router = Router();

// All invoice endpoints require authentication
router.use(requireAuth);

router.get('/:orderId', getInvoiceByOrderId);
router.get('/:orderId/pdf', getInvoicePdf);

export default router;
