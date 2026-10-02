import { Router } from 'express';
import { register, login, logout, getMe, googleLogin } from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// Public
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);

// Authenticated
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

export default router;
