import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';

const router = Router();

/**
 * @desc    Liveness probe: verifies process is alive and responsive
 * @route   GET /api/health
 * @access  Public (no auth, no rate limit)
 */
router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      ok: true,
      uptime: Math.floor(process.uptime()),
    },
    message: 'Service is alive',
  });
});

/**
 * @desc    Readiness probe: verifies MongoDB connection is established
 * @route   GET /api/health/ready
 * @access  Public (no auth, no rate limit)
 */
router.get('/ready', (_req: Request, res: Response) => {
  const isConnected = mongoose.connection.readyState === 1;

  if (!isConnected) {
    return res.status(503).json({
      success: false,
      data: {
        ready: false,
        db: 'disconnected',
      },
      message: 'Service is not ready — database disconnected',
    });
  }

  res.status(200).json({
    success: true,
    data: {
      ready: true,
      db: 'connected',
    },
    message: 'Service is ready',
  });
});

/**
 * @desc    Detailed diagnostics (internal/admin only)
 * @route   GET /api/health/detail
 * @access  Private (admin, owner)
 */
router.get(
  '/detail',
  requireAuth,
  requireRole('admin', 'owner'),
  (_req: Request, res: Response) => {
    const isConnected = mongoose.connection.readyState === 1;
    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        uptime: process.uptime(),
        db: isConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
      },
    });
  }
);

export default router;
