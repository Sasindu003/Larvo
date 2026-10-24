import { Router } from 'express';
import {
  createReturn,
  getMyReturns,
  getReturnById,
  getReturnByOrderId,
} from '../controllers/return.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { uploadReturnImages, handleMulterError } from '../middleware/upload.middleware';

const router = Router();

// All customer return routes require an authenticated user
router.use(requireAuth);

router.post('/', uploadReturnImages, handleMulterError, createReturn);
router.get('/me', getMyReturns);
router.get('/order/:orderId', getReturnByOrderId);
router.get('/:id', getReturnById);

export default router;
