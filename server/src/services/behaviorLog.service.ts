import crypto from 'crypto';
import UserBehaviorLog, { IUserBehaviorLog, BehaviorEventType } from '../models/UserBehaviorLog';
import { IUser } from '../models/User';
import { ParsedClientInfo, ParsedGeoLocation } from '../utils/deviceParser';
import { env } from '../config/env';

export interface IngestEventItem {
  sessionId: string;
  deviceId: string;
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
  screenResolution?: string;
  viewport?: string;
  language?: string;
  metadata?: Record<string, unknown>;
  timestamp?: string | number | Date;
}

export interface BehaviorLogQueryOptions {
  page?: number | string;
  limit?: number | string;
  sortBy?: 'createdAt' | 'eventType' | 'userRole' | 'ip' | 'path';
  sortOrder?: 'asc' | 'desc';
  eventType?: string;
  userRole?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface PaginatedBehaviorLogs {
  results: IUserBehaviorLog[];
  total: number;
  page: number;
  pages: number;
}

export const behaviorLogService = {
  /**
   * Ingest and persist a batch of behavior events
   */
  async recordBatch(
    events: IngestEventItem[],
    clientIp: string,
    location: ParsedGeoLocation,
    clientInfo: ParsedClientInfo,
    user?: IUser
  ): Promise<number> {
    if (!events || events.length === 0) return 0;

    const docs = events.map((ev) => {
      const createdAt = ev.timestamp ? new Date(ev.timestamp) : new Date();

      return {
        userId: user ? user._id : null,
        userRole: user?.role || 'guest',
        userEmail: user?.email || '',
        userName: user?.name || '',
        sessionId: ev.sessionId,
        deviceId: ev.deviceId,
        ip: clientIp,
        location: {
          country: location.country,
          region: location.region,
          city: location.city,
          timezone: location.timezone,
        },
        clientInfo: {
          browser: clientInfo.browser,
          os: clientInfo.os,
          device: clientInfo.device,
          userAgent: clientInfo.userAgent,
          screenResolution: ev.screenResolution || '',
          viewport: ev.viewport || '',
          language: ev.language || '',
        },
        eventType: ev.eventType,
        page: {
          path: ev.page.path || '/',
          url: ev.page.url || '',
          title: ev.page.title || '',
          referrer: ev.page.referrer || '',
        },
        target: {
          tagName: ev.target?.tagName || '',
          id: ev.target?.id || '',
          className: ev.target?.className || '',
          innerText: ev.target?.innerText || '',
          selector: ev.target?.selector || '',
          href: ev.target?.href || '',
          ariaLabel: ev.target?.ariaLabel || '',
          coords: ev.target?.coords || { x: 0, y: 0 },
        },
        metadata: ev.metadata || {},
        createdAt: isNaN(createdAt.getTime()) ? new Date() : createdAt,
      };
    });

    const inserted = await UserBehaviorLog.insertMany(docs, { ordered: false });
    return inserted.length;
  },

  /**
   * Retrieve paginated, sorted, and filtered behavior tracking logs
   */
  async getLogs(options: BehaviorLogQueryOptions): Promise<PaginatedBehaviorLogs> {
    const page = Math.max(1, parseInt(String(options.page || 1), 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(String(options.limit || 25), 10) || 25));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (options.eventType && options.eventType !== 'all') {
      filter.eventType = options.eventType;
    }

    if (options.userRole && options.userRole !== 'all') {
      filter.userRole = options.userRole;
    }

    if (options.startDate || options.endDate) {
      filter.createdAt = {};
      if (options.startDate) {
        filter.createdAt.$gte = new Date(options.startDate);
      }
      if (options.endDate) {
        filter.createdAt.$lte = new Date(options.endDate);
      }
    }

    if (options.search && options.search.trim()) {
      const q = options.search.trim();
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');

      filter.$or = [
        { userEmail: regex },
        { userName: regex },
        { ip: regex },
        { 'page.path': regex },
        { 'target.innerText': regex },
        { deviceId: regex },
        { sessionId: regex },
      ];
    }

    // Determine sort key and direction
    const orderDirection = options.sortOrder === 'asc' ? 1 : -1;
    let sortObj: Record<string, 1 | -1> = { createdAt: -1 };

    switch (options.sortBy) {
      case 'createdAt':
        sortObj = { createdAt: orderDirection };
        break;
      case 'eventType':
        sortObj = { eventType: orderDirection, createdAt: -1 };
        break;
      case 'userRole':
        sortObj = { userRole: orderDirection, createdAt: -1 };
        break;
      case 'ip':
        sortObj = { ip: orderDirection, createdAt: -1 };
        break;
      case 'path':
        sortObj = { 'page.path': orderDirection, createdAt: -1 };
        break;
      default:
        sortObj = { createdAt: orderDirection };
    }

    const [results, total] = await Promise.all([
      UserBehaviorLog.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      UserBehaviorLog.countDocuments(filter).exec(),
    ]);

    return {
      results: results as unknown as IUserBehaviorLog[],
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    };
  },

  /**
   * Timing-safe verification of the tracking section passkey
   */
  verifyPasskey(candidateKey: string): boolean {
    if (!candidateKey || typeof candidateKey !== 'string') {
      return false;
    }

    const expected = env.TRACKING_PASSKEY;
    if (!expected) return false;

    // Use SHA-256 digests for constant-time comparison
    const a = crypto.createHash('sha256').update(candidateKey.trim()).digest();
    const b = crypto.createHash('sha256').update(expected.trim()).digest();

    return crypto.timingSafeEqual(a, b);
  },
};
