import rateLimit from 'express-rate-limit';

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
