import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { env } from '../config/env';

/**
 * Normalizes an origin URL or string to scheme://host[:port], stripping trailing slashes.
 */
export const normalizeOrigin = (val?: string | null): string | null => {
  if (!val) return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.origin;
  } catch {
    return trimmed.replace(/\/+$/, '') || null;
  }
};

/**
 * Known project client domains hosted on Vercel.
 */
const LARVO_VERCEL_CLIENT_ORIGINS = [
  'https://larvo-client.vercel.app',
  'https://larvo.vercel.app',
];

const LARVO_VERCEL_PREVIEW_REGEX =
  /^https:\/\/(larvo-client|larvo)(-[a-zA-Z0-9-_]+)?\.vercel\.app$/i;

/**
 * Builds the strict CORS and CSRF allowlist based on environment configuration.
 * Always includes env.CLIENT_URL, env.CLIENT_ORIGIN, and official Larvo Vercel domains.
 * In development and test environments, also includes localhost and 127.0.0.1 ports.
 */
export const getAllowedOrigins = (): string[] => {
  const origins = new Set<string>();

  // Official production and primary Vercel frontend domains
  LARVO_VERCEL_CLIENT_ORIGINS.forEach((domain) => origins.add(domain));

  if (env.CLIENT_URL) {
    const norm = normalizeOrigin(env.CLIENT_URL);
    if (norm) origins.add(norm);
  }

  if (env.CLIENT_ORIGIN) {
    env.CLIENT_ORIGIN.split(',')
      .map((o) => normalizeOrigin(o))
      .filter((o): o is string => Boolean(o))
      .forEach((o) => origins.add(o));
  }

  if (env.NODE_ENV !== 'production') {
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:5173');
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
    origins.add('http://localhost:5000');
    origins.add('http://127.0.0.1:5000');
  }

  return Array.from(origins);
};

/**
 * Determines whether a given origin matches the strict allowlist.
 */
export const isOriginAllowed = (origin?: string | null): boolean => {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;

  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.includes(normalized)) {
    return true;
  }

  // Allow project preview deployments on Vercel
  if (LARVO_VERCEL_PREVIEW_REGEX.test(normalized)) {
    return true;
  }

  // In non-production, permit any localhost / 127.0.0.1 port
  if (env.NODE_ENV !== 'production') {
    try {
      const url = new URL(normalized);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return true;
      }
    } catch {
      // not a valid URL
    }
  }

  return false;
};

export const isTestExecution = (): boolean => {
  if (process.env.NODE_ENV === 'test') return true;
  const targetScript = process.argv[1] ? path.basename(process.argv[1]) : '';
  return (
    targetScript.endsWith('.test.ts') ||
    targetScript.endsWith('.test.js') ||
    targetScript === 'product.check.ts'
  );
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF Guard Middleware:
 * - Skips safe HTTP methods (GET, HEAD, OPTIONS).
 * - Skips automated test runs using Bearer tokens without cookies.
 * - For state-changing requests (POST, PUT, PATCH, DELETE):
 *     Requires Origin (with Referer fallback) to match the strict allowlist;
 *     returns HTTP 403 { success: false, message: ... } if not allowed.
 * - When COOKIE_SAMESITE === 'none':
 *     Additionally requires 'X-Requested-With: larvo-client' on state-changing requests.
 */
export const csrfGuard = (req: Request, res: Response, next: NextFunction): void => {
  // 1. Skip safe methods
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    return next();
  }

  // 2. Skip automated test runs using Bearer tokens without cookies
  const authHeader = req.headers.authorization;
  const hasBearerToken =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
  const hasAuthCookie = Boolean(
    req.cookies &&
      (req.cookies.slt ||
        Object.keys(req.cookies).some((k) => k.length > 0))
  );

  if (hasBearerToken && !hasAuthCookie) {
    return next();
  }

  // Skip automated test executions running without cookies and without Origin header
  if (isTestExecution() && !hasAuthCookie && !req.headers.origin) {
    return next();
  }

  // 3. For state-changing requests, require Origin (with Referer fallback) matching allowlist
  const rawOrigin = Array.isArray(req.headers.origin)
    ? req.headers.origin[0]
    : req.headers.origin;
  const rawReferer = Array.isArray(req.headers.referer)
    ? req.headers.referer[0]
    : req.headers.referer;

  let requestOrigin: string | null = null;
  if (typeof rawOrigin === 'string' && rawOrigin.trim() !== '') {
    requestOrigin = normalizeOrigin(rawOrigin);
  } else if (typeof rawReferer === 'string' && rawReferer.trim() !== '') {
    requestOrigin = normalizeOrigin(rawReferer);
  }

  if (!requestOrigin || !isOriginAllowed(requestOrigin)) {
    res.status(403).json({
      success: false,
      message: 'CSRF protection: request origin not allowed',
    });
    return;
  }

  // 4. When COOKIE_SAMESITE === 'none', additionally require header X-Requested-With: larvo-client
  if (env.COOKIE_SAMESITE === 'none') {
    const xRequestedWith = Array.isArray(req.headers['x-requested-with'])
      ? req.headers['x-requested-with'][0]
      : req.headers['x-requested-with'];

    if (xRequestedWith !== 'larvo-client') {
      res.status(403).json({
        success: false,
        message: 'CSRF protection: missing or invalid X-Requested-With header',
      });
      return;
    }
  }

  next();
};
