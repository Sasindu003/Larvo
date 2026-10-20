import mongoose, { Document, Schema, Types } from 'mongoose';
import { env } from '../config/env';

export const AUDIT_ACTIONS = [
  'AUTH_LOGIN_SUCCESS',
  'AUTH_LOGIN_FAILURE',
  'AUTH_REGISTER',
  'AUTH_PASSWORD_CHANGE',
  'USER_ROLE_CHANGE',
  'ORDER_CREATE',
  'ORDER_STATUS_CHANGE',
  'PAYMENT_REVIEW_DECISION',
  'WALLET_CREDIT',
  'WALLET_DEBIT',
  'REFUND_ISSUED',
  'COUPON_CREATE',
  'COUPON_UPDATE',
  'COUPON_DELETE',
  'STOCK_ADJUST',
  'RETURN_DECISION',
  'PURCHASE_ORDER_CREATE',
  'PURCHASE_ORDER_RECEIVE',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface IAuditLog extends Document {
  userId?: Types.ObjectId | null;
  role: string;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  ip: string;
  userAgent: string;
  requestId: string;
  meta: Record<string, unknown>;
  createdAt: Date;
}

const MAX_META_BYTES = 16384; // 16 KB size limit for audit metadata

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    role: {
      type: String,
      default: 'anonymous',
      trim: true,
    },
    action: {
      type: String,
      required: true,
      enum: AUDIT_ACTIONS,
    },
    entityType: {
      type: String,
      required: true,
      trim: true,
    },
    entityId: {
      type: String,
      trim: true,
    },
    ip: {
      type: String,
      default: '',
      trim: true,
    },
    userAgent: {
      type: String,
      default: '',
      trim: true,
    },
    requestId: {
      type: String,
      default: '',
      trim: true,
    },
    meta: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    bufferCommands: false, // Fail fast if MongoDB is disconnected rather than hanging
  }
);

// Size-limiting pre-validate hook on meta
auditLogSchema.pre('validate', function (next) {
  if (this.meta !== undefined && this.meta !== null) {
    try {
      const metaString = JSON.stringify(this.meta);
      if (metaString.length > MAX_META_BYTES) {
        this.meta = {
          _truncated: true,
          _originalBytes: metaString.length,
          preview: metaString.slice(0, 1024),
        };
      }
    } catch {
      this.meta = {
        _unserializable: true,
      };
    }
  }
  next();
});

// Compound indexes for fast audit querying
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });

// Optional TTL index driven by AUDIT_LOG_TTL_DAYS
if (env.AUDIT_LOG_TTL_DAYS && env.AUDIT_LOG_TTL_DAYS > 0) {
  auditLogSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: env.AUDIT_LOG_TTL_DAYS * 86400 }
  );
}

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
export default AuditLog;
