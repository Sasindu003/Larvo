import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';
import User from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/error.middleware';
import { RegisterSchema } from '../validators/auth.validator';
import { OAuth2Client } from 'google-auth-library';

// ── Helper: sign JWT and set httpOnly cookie ────────────────────────────────
function signTokenAndSetCookie(user: any, res: Response) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');

  const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as any;

  const token = jwt.sign(
    { sub: user._id, role: user.role },
    secret,
    { expiresIn }
  );

  // Parse expiresIn to milliseconds for cookie maxAge
  const daysMatch = expiresIn.match(/^(\d+)d$/);
  const maxAge = daysMatch
    ? parseInt(daysMatch[1], 10) * 24 * 60 * 60 * 1000
    : 7 * 24 * 60 * 60 * 1000; // default 7 days

  res.cookie('slt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge,
    path: '/',
  });
}

/**
 * @desc    Register a new customer account
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  let parsed;
  try {
    parsed = RegisterSchema.parse(req.body);
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Validation failed', 422, errors);
    }
    throw err;
  }

  const { name, email, password } = parsed;

  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError('An account with this email already exists', 409);
  }

  const user = await User.create({
    name,
    email,
    passwordHash: password,
    role: 'customer',
  });

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    data: { user },
  });
});

/**
 * @desc    Authenticate user and issue JWT cookie
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError('Please provide email and password', 400);
  }

  // +passwordHash needed for compare — it's select:false on the schema
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');

  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  if (!user.active) {
    throw new AppError('Account is deactivated', 403);
  }

  if (!user.passwordHash || !(await user.comparePassword(password))) {
    // Generic message to prevent user enumeration
    throw new AppError('Invalid credentials', 401);
  }

  signTokenAndSetCookie(user, res);

  res.status(200).json({
    success: true,
    message: 'Logged in successfully',
    data: { user },
  });
});

/**
 * @desc    Clear JWT cookie (logout)
 * @route   POST /api/auth/logout
 * @access  Authenticated
 */
export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.cookie('slt', '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * @desc    Get current authenticated user
 * @route   GET /api/auth/me
 * @access  Authenticated
 */
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: { user: req.user },
  });
});

/**
 * @desc    Authenticate via Google ID token (GIS One Tap / button flow)
 * @route   POST /api/auth/google
 * @access  Public
 */
export const googleLogin = asyncHandler(async (req: Request, res: Response) => {
  const { credential } = req.body;

  if (!credential) {
    throw new AppError('Google credential token is required', 400);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new AppError('Google authentication is not configured', 500);
  }

  const client = new OAuth2Client(clientId);

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
  } catch {
    throw new AppError('Invalid or expired Google token', 401);
  }

  const payload = ticket.getPayload();
  if (!payload) {
    throw new AppError('Unable to extract Google user info', 401);
  }

  const { sub: googleId, email, email_verified, name } = payload;

  if (!email_verified) {
    throw new AppError('Google email is not verified', 401);
  }

  if (!email) {
    throw new AppError('Google account has no email', 401);
  }

  // Look up by email first (link-by-email strategy)
  let user = await User.findOne({ email: email.toLowerCase() });

  if (user) {
    // Existing user — link Google ID if not already linked
    if (!user.googleId) {
      user.googleId = googleId;
      user.authProvider = user.authProvider === 'local' ? 'local' : 'google';
      await user.save();
    }

    if (!user.active) {
      throw new AppError('Account is deactivated', 403);
    }
  } else {
    // New user — create with Google auth, no password
    user = await User.create({
      name: name || email.split('@')[0],
      email: email.toLowerCase(),
      googleId,
      authProvider: 'google',
      role: 'customer',
    });
  }

  signTokenAndSetCookie(user, res);

  res.status(200).json({
    success: true,
    message: 'Logged in with Google successfully',
    data: { user },
  });
});
