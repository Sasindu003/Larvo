import api, { ApiResponse } from './api';

export interface BehaviorLogItem {
  _id: string;
  userId?: {
    _id: string;
    name: string;
    email: string;
    role: string;
  } | string | null;
  userRole: string;
  userEmail?: string;
  userName?: string;
  sessionId: string;
  deviceId: string;
  ip: string;
  location?: {
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
  eventType: 'click' | 'page_view' | 'navigation' | 'form_submit' | 'custom';
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
  createdAt: string;
}

export interface PaginatedBehaviorLogsResponse {
  results: BehaviorLogItem[];
  total: number;
  page: number;
  pages: number;
}

export interface GetBehaviorLogsParams {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'dateTime' | 'eventType' | 'userRole' | 'ip' | 'path';
  sortOrder?: 'asc' | 'desc';
  eventType?: string;
  userRole?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  date?: string;
  hour?: number;
  minute?: number;
}

export const trackingService = {
  /**
   * Ingest batched behavior events
   */
  async sendEvents(events: any[], clientTimezone?: string): Promise<ApiResponse<{ ingested: number }>> {
    return api.post('/tracking/events', {
      events,
      clientTimezone,
    });
  },

  /**
   * Verify tracking console access passkey
   */
  async verifyPasskey(passkey: string): Promise<ApiResponse<{ verified: boolean }>> {
    return api.post('/tracking/verify-key', { passkey });
  },

  /**
   * Fetch paginated and sorted behavior logs (Admin only)
   */
  async getLogs(params: GetBehaviorLogsParams): Promise<ApiResponse<PaginatedBehaviorLogsResponse>> {
    return api.get('/tracking/logs', { params });
  },

  /**
   * Delete selected behavior logs by ID
   */
  async deleteLogs(logIds: string[]): Promise<ApiResponse<{ deletedCount: number }>> {
    return api.delete('/tracking/logs', { data: { logIds } });
  },

  /**
   * Clear all behavior logs or logs matching age / date filter
   */
  async clearAllLogs(options?: { olderThanDays?: number; date?: string }): Promise<ApiResponse<{ deletedCount: number }>> {
    return api.post('/tracking/logs/clear', options || {});
  },
};

export default trackingService;
