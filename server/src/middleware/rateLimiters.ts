import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Rate limiter for authentication endpoints (login, register, Google auth, password updates).
 * Limit: 10 requests per 15 minutes per IP.
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // 10 requests per window per IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
  statusCode: 429,
});

/**
 * Rate limiter for sensitive transactional mutations (order creation, payments, wallet adjustments).
 * Limit: 30 requests per 15 minutes per authenticated user ID or IP.
 */
export const transactionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30, // 30 requests per window per user/IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const user = (req as any).user;
    return user?._id?.toString() || ipKeyGenerator(req.ip || '');
  },
  message: {
    success: false,
    message: 'Too many transaction requests. Please try again after 15 minutes.',
  },
  statusCode: 429,
});

/**
 * Rate limiter for POST /api/inventory/validate.
 * Limits anonymous and guest traffic to 10 requests per minute per IP
 * to prevent bulk scraping and inventory enumeration attacks.
 */
export const validateInventoryRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 10, // 10 requests per window per IP
  standardHeaders: 'draft-7', // combined `RateLimit` header
  legacyHeaders: false, // disable `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many inventory validation requests. Please try again later.',
  },
  statusCode: 429,
});

