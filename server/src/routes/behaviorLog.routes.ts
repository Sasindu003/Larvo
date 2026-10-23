import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  collectBehaviorEvents,
  verifyTrackingPasskey,
  getBehaviorLogs,
} from '../controllers/behaviorLog.controller';
import { optionalAuth, requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';

const router = Router();

// Ingestion rate limiter: 120 batches per minute per IP
const trackingIngestLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many tracking events sent. Please throttle requests.',
  },
  statusCode: 429,
});

// Passkey verification rate limiter: 10 attempts per 15 minutes per IP to prevent brute force
const passkeyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many passkey verification attempts. Please try again after 15 minutes.',
  },
  statusCode: 429,
});

/**
 * @route   POST /api/tracking/events
 * @desc    Collect client behavior events (clicks, navigations, pageviews)
 * @access  Public / Optional Auth
 */
router.post('/events', trackingIngestLimiter, optionalAuth, collectBehaviorEvents);

/**
 * @route   POST /api/tracking/verify-key
 * @desc    Verify tracking section passkey
 * @access  Admin, Owner
 */
router.post(
  '/verify-key',
  passkeyLimiter,
  requireAuth,
  requireRole('admin', 'owner'),
  verifyTrackingPasskey
);

/**
 * @route   GET /api/tracking/logs
 * @desc    Get paginated, sorted, and filtered tracking logs
 * @access  Admin, Owner
 */
router.get(
  '/logs',
  requireAuth,
  requireRole('admin', 'owner'),
  getBehaviorLogs
);

export default router;
