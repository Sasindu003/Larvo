import express from 'express';
import { validateInventory } from '../controllers/inventory.controller';
import { optionalAuth } from '../middleware/auth.middleware';
import { validateInventoryRateLimit } from '../middleware/rateLimiters';

const router = express.Router();

router.post('/validate', validateInventoryRateLimit, optionalAuth, validateInventory);

export default router;
