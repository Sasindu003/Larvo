import { Router } from 'express';
import { register, login, logout, getMe, googleLogin } from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';
import { authRateLimit } from '../middleware/rateLimiters';

const router = Router();

// Public
router.post('/register', authRateLimit, register);
router.post('/login', authRateLimit, login);
router.post('/google', authRateLimit, googleLogin);

// Authenticated
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

export default router;
