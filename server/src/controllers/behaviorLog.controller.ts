import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { behaviorLogService } from '../services/behaviorLog.service';
import { extractClientIp, extractGeoLocation, parseUserAgent } from '../utils/deviceParser';
import {
  IngestEventsSchema,
  GetLogsQuerySchema,
  VerifyPasskeySchema,
} from '../validators/behaviorLog.validator';
import { AppError } from '../middleware/error.middleware';

/**
 * @desc    Collect batch of user behavior events (clicks, navigations, pageviews)
 * @route   POST /api/tracking/events
 * @access  Public / Optional Auth (tracks guest, customer, staff, admin, owner)
 */
export const collectBehaviorEvents = asyncHandler(async (req: Request, res: Response) => {
  const parsed = IngestEventsSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      parsed.error.errors.map((e) => e.message).join(', ') || 'Invalid tracking payload',
      400
    );
  }

  const clientIp = extractClientIp(req);
  const location = extractGeoLocation(req, parsed.data.clientTimezone);
  const clientInfo = parseUserAgent(req.headers['user-agent']);

  const count = await behaviorLogService.recordBatch(
    parsed.data.events,
    clientIp,
    location,
    clientInfo,
    req.user
  );

  res.status(200).json({
    success: true,
    data: { ingested: count },
    message: 'Behavior events recorded successfully',
  });
});

/**
 * @desc    Verify admin tracking console passkey
 * @route   POST /api/tracking/verify-key
 * @access  Admin, Owner
 */
export const verifyTrackingPasskey = asyncHandler(async (req: Request, res: Response) => {
  const parsed = VerifyPasskeySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError('Passkey is required', 400);
  }

  const isValid = behaviorLogService.verifyPasskey(parsed.data.passkey);
  if (!isValid) {
    throw new AppError('Invalid tracking passkey', 403);
  }

  res.status(200).json({
    success: true,
    data: { verified: true },
    message: 'Tracking console unlocked',
  });
});

/**
 * @desc    Get paginated, filtered, and sorted behavior tracking logs
 * @route   GET /api/tracking/logs
 * @access  Admin, Owner
 */
export const getBehaviorLogs = asyncHandler(async (req: Request, res: Response) => {
  const parsed = GetLogsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      parsed.error.errors.map((e) => e.message).join(', ') || 'Invalid query parameters',
      400
    );
  }

  const result = await behaviorLogService.getLogs(parsed.data);

  res.status(200).json({
    success: true,
    data: result,
    message: 'Behavior tracking logs retrieved successfully',
  });
});
