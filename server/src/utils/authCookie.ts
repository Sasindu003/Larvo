import { Response, CookieOptions } from 'express';
import { env } from '../config/env';

export const AUTH_COOKIE_NAME = 'slt';

/**
 * Retains maxAge calculation from env.JWT_EXPIRES_IN.
 * Defaults to 7 days if pattern does not match '<N>d'.
 */
export const getAuthCookieMaxAge = (expiresIn: string = env.JWT_EXPIRES_IN): number => {
  const daysMatch = typeof expiresIn === 'string' ? expiresIn.match(/^(\d+)d$/) : null;
  return daysMatch
    ? parseInt(daysMatch[1], 10) * 24 * 60 * 60 * 1000
    : 7 * 24 * 60 * 60 * 1000;
};

/**
 * Derives common auth cookie options based on environment policy.
 * - httpOnly is always true.
 * - secure is true when NODE_ENV === 'production' || COOKIE_SAMESITE === 'none'.
 * - sameSite is driven by COOKIE_SAMESITE ('lax' by default).
 * - path is root '/'.
 */
export const getAuthCookieOptions = (): CookieOptions => {
  const isSecure =
    env.COOKIE_SECURE ??
    (env.NODE_ENV === 'production' || env.COOKIE_SAMESITE === 'none');

  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: env.COOKIE_SAMESITE,
    path: '/',
  };
};

/**
 * Sets the authentication JWT cookie on the response.
 */
export const setAuthCookie = (res: Response, token: string): void => {
  const options: CookieOptions = {
    ...getAuthCookieOptions(),
    maxAge: getAuthCookieMaxAge(),
  };
  res.cookie(AUTH_COOKIE_NAME, token, options);
};

/**
 * Clears the authentication JWT cookie with identical attributes.
 */
export const clearAuthCookie = (res: Response): void => {
  const options: CookieOptions = {
    ...getAuthCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  };
  res.cookie(AUTH_COOKIE_NAME, '', options);
};
