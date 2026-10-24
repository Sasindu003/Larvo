import { Request } from 'express';
import mongoose, { Types } from 'mongoose';
import AuditLog, { AuditAction, AUDIT_ACTIONS } from '../models/AuditLog';
import { logger } from '../utils/logger';

export { AuditAction, AUDIT_ACTIONS };

const SENSITIVE_KEY_REGEX = /password|token|secret|cookie|authorization|card|slip|pan|cvv|cvc|iban|account/i;
const MAX_META_BYTES = 16384; // 16 KB metadata threshold

/**
 * Recursively sanitizes metadata by stripping sensitive keys and replacing
 * circular object references with '[Circular]'.
 */
function sanitizeRecursive(val: unknown, seen: WeakSet<object>): unknown {
  if (val === null || val === undefined) {
    return val;
  }
  if (typeof val !== 'object') {
    return val;
  }
  if (seen.has(val as object)) {
    return '[Circular]';
  }
  seen.add(val as object);

  if (Array.isArray(val)) {
    return val.map((item) => sanitizeRecursive(item, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, propVal] of Object.entries(val as Record<string, unknown>)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      continue; // Strip sensitive key entirely
    }
    result[key] = sanitizeRecursive(propVal, seen);
  }
  return result;
}

/**
 * Strips sensitive keys, resolves circular references, and truncates oversized
 * metadata payloads before persistence.
 */
export function sanitizeAndTruncateMeta(meta?: unknown): Record<string, unknown> {
  if (!meta || typeof meta !== 'object') {
    return {};
  }
  try {
    const seen = new WeakSet<object>();
    const cleaned = sanitizeRecursive(meta, seen) as Record<string, unknown>;
    const str = JSON.stringify(cleaned);
    if (str.length > MAX_META_BYTES) {
      return {
        _truncated: true,
        _originalBytes: str.length,
        preview: str.slice(0, 1024),
      };
    }
    return cleaned;
  } catch {
    return { _unserializable: true };
  }
}

/**
 * Records an immutable audit log entry.
 *
 * Guarantees:
 * - Fire-and-forget: Does not need to be awaited on request handling paths.
 * - Non-blocking & zero-throw: Any internal failure, disconnected database,
 *   or invalid metadata is caught and logged; callers are never interrupted.
 * - Sensitive data stripping: Passwords, tokens, cookies, secrets, payment slips,
 *   and cards are recursively purged from metadata.
 *
 * @param req Optional Express Request context to derive actor and network details
 * @param action Standardized audit action from AuditAction union
 * @param entityType Name of modified domain entity (e.g., 'Order', 'User')
 * @param entityId Identifier of target entity
 * @param meta Optional supplementary metadata
 * @param actor Optional actor override ({ _id, role }) for endpoints where req.user is unpopulated
 */
export async function audit(
  req: Request | null | undefined,
  action: AuditAction,
  entityType: string,
  entityId?: string | Types.ObjectId | null,
  meta?: Record<string, unknown> | null,
  actor?: { _id?: Types.ObjectId | string; role?: string }
): Promise<void> {
  try {
    // 1. Sanitize and size-bound metadata
    const sanitizedMeta = sanitizeAndTruncateMeta(meta);

    // 2. Derive user ID
    let userId: Types.ObjectId | null = null;
    const actorId = actor?._id || (req as any)?.user?._id;
    if (actorId) {
      if (actorId instanceof Types.ObjectId) {
        userId = actorId;
      } else if (Types.ObjectId.isValid(String(actorId))) {
        userId = new Types.ObjectId(String(actorId));
      }
    }

    // 3. Derive role, IP, userAgent, and requestId
    const role = actor?.role || (req as any)?.user?.role || (req ? 'anonymous' : 'system');

    let ip = '';
    if (req) {
      if (req.ip) {
        ip = req.ip;
      } else if (req.headers && req.headers['x-forwarded-for']) {
        const forwarded = req.headers['x-forwarded-for'];
        ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
      } else if (req.socket?.remoteAddress) {
        ip = req.socket.remoteAddress;
      }
    }

    let userAgent = '';
    if (req) {
      if (typeof req.get === 'function') {
        userAgent = req.get('user-agent') || '';
      } else if (req.headers && req.headers['user-agent']) {
        userAgent = String(req.headers['user-agent']);
      }
    }

    let requestId = '';
    if (req) {
      if ((req as any).id) {
        requestId = String((req as any).id);
      } else if (req.headers && req.headers['x-request-id']) {
        requestId = String(req.headers['x-request-id']);
      }
    }

    const normalizedEntityId =
      entityId !== null && entityId !== undefined ? String(entityId) : null;

    // 4. Check MongoDB connection state: fail fast without buffering or hanging
    if (mongoose.connection.readyState !== 1) {
      logger.warn(
        { action, entityType, entityId: normalizedEntityId },
        'Audit log skipped: database is disconnected'
      );
      return;
    }

    // 5. Persist audit log (omitting unset optional keys to satisfy null-omission hygiene)
    const logData: Record<string, unknown> = {
      role,
      action,
      entityType,
      ip,
      userAgent,
      requestId,
      meta: sanitizedMeta,
    };
    if (userId) {
      logData.userId = userId;
    }
    if (normalizedEntityId) {
      logData.entityId = normalizedEntityId;
    }

    await AuditLog.create(logData);
  } catch (err) {
    logger.error(
      {
        err,
        action,
        entityType,
        entityId: entityId ? String(entityId) : null,
      },
      'Failed to record audit log'
    );
  }
}

/**
 * Records an immutable PII_READ audit entry when an authorized staff, admin, owner,
 * or delivery manager reads another person's full personal data (e.g. line1, phone).
 *
 * Guarantees:
 * - Only field names (e.g. ['shippingAddress.line1', 'shippingAddress.phone']) and viewerRole are recorded.
 * - Personal field values are NEVER logged or retained in metadata.
 * - Never called for customer reading their own records.
 */
export async function auditPiiRead(
  req: Request | null | undefined,
  entityType: string,
  entityId: string | Types.ObjectId | null | undefined,
  fields: string[],
  viewerRole?: string
): Promise<void> {
  const role = viewerRole || (req as any)?.user?.role || 'staff';
  return audit(req, 'PII_READ', entityType, entityId, {
    fields,
    viewerRole: role,
  });
}

export default audit;
