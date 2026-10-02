import { Router } from 'express';
import {
  createReturn,
  getMyReturns,
  getReturnById,
  getReturnByOrderId,
} from '../controllers/return.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// All customer return routes require an authenticated user
router.use(requireAuth);

router.post('/', createReturn);
router.get('/me', getMyReturns);
router.get('/order/:orderId', getReturnByOrderId);
router.get('/:id', getReturnById);

export default router;
