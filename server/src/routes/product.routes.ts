import { Router } from 'express';
import {
  getProducts,
  getProductSuggestions,
  getProductBySlug,
} from '../controllers/product.controller';

const router = Router();

// GET /api/products (Paginated list & search)
router.get('/', getProducts);

// GET /api/products/suggest (Autocomplete / Top 5 suggestions)
router.get('/suggest', getProductSuggestions);

// GET /api/products/:slug (Single product detail)
router.get('/:slug', getProductBySlug);

export default router;
