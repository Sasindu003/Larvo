import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  getWishlist,
  toggleWishlist,
  removeFromWishlist,
} from '../controllers/wishlist.controller';

const router = Router();

// All wishlist routes require authentication
router.use(requireAuth);

router.get('/', getWishlist);
router.post('/:productId', toggleWishlist);
router.delete('/:productId', removeFromWishlist);

export default router;
