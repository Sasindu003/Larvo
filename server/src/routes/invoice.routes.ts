import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { noStore } from '../middleware/noStore';
import { getInvoiceByOrderId, getInvoicePdf } from '../controllers/invoice.controller';

const router = Router();

// Invoice endpoints must not be cached by browsers or shared intermediaries
router.use(noStore);
// All invoice endpoints require authentication
router.use(requireAuth);

router.get('/:orderId', getInvoiceByOrderId);
router.get('/:orderId/pdf', getInvoicePdf);

export default router;
