import mongoose, { Document, Schema, Types } from 'mongoose';

export type BehaviorEventType = 'click' | 'page_view' | 'navigation' | 'form_submit' | 'custom';

export interface IUserBehaviorLog extends Document {
  userId?: Types.ObjectId | null;
  userRole: string;
  userEmail?: string;
  userName?: string;
  sessionId: string;
  deviceId: string;
  ip: string;
  location: {
    country?: string;
    region?: string;
    city?: string;
    timezone?: string;
  };
  clientInfo: {
    browser: {
      name: string;
      version: string;
    };
    os: {
      name: string;
      version: string;
    };
    device: {
      type: string;
      vendor?: string;
      model?: string;
    };
    userAgent: string;
    screenResolution?: string;
    viewport?: string;
    language?: string;
  };
  eventType: BehaviorEventType;
  page: {
    path: string;
    url?: string;
    title?: string;
    referrer?: string;
  };
  target?: {
    tagName?: string;
    id?: string;
    className?: string;
    innerText?: string;
    selector?: string;
    href?: string;
    ariaLabel?: string;
    coords?: {
      x: number;
      y: number;
    };
  };
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const userBehaviorLogSchema = new Schema<IUserBehaviorLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    userRole: {
      type: String,
      default: 'guest',
      trim: true,
      index: true,
    },
    userEmail: {
      type: String,
      trim: true,
      default: '',
    },
    userName: {
      type: String,
      trim: true,
      default: '',
    },
    sessionId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    ip: {
      type: String,
      default: 'Unknown',
      trim: true,
      index: true,
    },
    location: {
      country: { type: String, default: 'Unknown', trim: true },
      region: { type: String, default: '', trim: true },
      city: { type: String, default: '', trim: true },
      timezone: { type: String, default: '', trim: true },
    },
    clientInfo: {
      browser: {
        name: { type: String, default: 'Unknown', trim: true },
        version: { type: String, default: '', trim: true },
      },
      os: {
        name: { type: String, default: 'Unknown', trim: true },
        version: { type: String, default: '', trim: true },
      },
      device: {
        type: { type: String, default: 'desktop', trim: true },
        vendor: { type: String, default: '', trim: true },
        model: { type: String, default: '', trim: true },
      },
      userAgent: { type: String, default: '', trim: true },
      screenResolution: { type: String, default: '', trim: true },
      viewport: { type: String, default: '', trim: true },
      language: { type: String, default: '', trim: true },
    },
    eventType: {
      type: String,
      required: true,
      enum: ['click', 'page_view', 'navigation', 'form_submit', 'custom'],
      index: true,
    },
    page: {
      path: { type: String, required: true, trim: true, index: true },
      url: { type: String, default: '', trim: true },
      title: { type: String, default: '', trim: true },
      referrer: { type: String, default: '', trim: true },
    },
    target: {
      tagName: { type: String, default: '', trim: true },
      id: { type: String, default: '', trim: true },
      className: { type: String, default: '', trim: true },
      innerText: { type: String, default: '', trim: true },
      selector: { type: String, default: '', trim: true },
      href: { type: String, default: '', trim: true },
      ariaLabel: { type: String, default: '', trim: true },
      coords: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
      },
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    bufferCommands: false,
  }
);

// Immutability: Block deletion operations to ensure audit integrity
const blockDeletion = function () {
  throw new Error('ImmutableAuditError: Deletion of user behavior tracking logs is strictly prohibited.');
};

userBehaviorLogSchema.pre('deleteOne', blockDeletion);
userBehaviorLogSchema.pre('deleteMany', blockDeletion);
userBehaviorLogSchema.pre('findOneAndDelete', blockDeletion);

// High performance indexes
userBehaviorLogSchema.index({ createdAt: -1 });
userBehaviorLogSchema.index({ createdAt: 1 });
userBehaviorLogSchema.index({ eventType: 1, createdAt: -1 });
userBehaviorLogSchema.index({ userRole: 1, createdAt: -1 });
userBehaviorLogSchema.index({ deviceId: 1, createdAt: -1 });
userBehaviorLogSchema.index({ sessionId: 1, createdAt: -1 });
userBehaviorLogSchema.index({ ip: 1, createdAt: -1 });

export const UserBehaviorLog = mongoose.model<IUserBehaviorLog>(
  'UserBehaviorLog',
  userBehaviorLogSchema,
  'user_behavior_logs'
);

export default UserBehaviorLog;
