import { z } from 'zod';

export const IngestEventItemSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required').max(128),
  deviceId: z.string().min(1, 'Device ID is required').max(128),
  eventType: z.enum(['click', 'page_view', 'navigation', 'form_submit', 'custom']),
  page: z.object({
    path: z.string().min(1).max(2048),
    url: z.string().max(4096).optional(),
    title: z.string().max(512).optional(),
    referrer: z.string().max(4096).optional(),
  }),
  target: z
    .object({
      tagName: z.string().max(64).optional(),
      id: z.string().max(256).optional(),
      className: z.string().max(1024).optional(),
      innerText: z.string().max(500).optional(),
      selector: z.string().max(1024).optional(),
      href: z.string().max(2048).optional(),
      ariaLabel: z.string().max(256).optional(),
      coords: z
        .object({
          x: z.number().default(0),
          y: z.number().default(0),
        })
        .optional(),
    })
    .optional(),
  screenResolution: z.string().max(64).optional(),
  viewport: z.string().max(64).optional(),
  language: z.string().max(32).optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.union([z.string(), z.number(), z.date()]).optional(),
});

export const IngestEventsSchema = z.object({
  events: z.array(IngestEventItemSchema).min(1, 'At least 1 event required').max(50, 'Max 50 events per batch'),
  clientTimezone: z.string().max(64).optional(),
});

export const GetLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(['createdAt', 'dateTime', 'eventType', 'userRole', 'ip', 'path']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  eventType: z.string().optional(),
  userRole: z.string().optional(),
  search: z.string().max(256).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  date: z.string().max(32).optional(),
  hour: z.coerce.number().int().min(0).max(23).optional(),
  minute: z.coerce.number().int().min(0).max(59).optional(),
});

export const VerifyPasskeySchema = z.object({
  passkey: z.string().min(1, 'Passkey is required').max(128),
});

export const DeleteSelectedLogsSchema = z.object({
  logIds: z.array(z.string().min(1)).min(1, 'At least one log ID must be selected'),
});

export const ClearLogsSchema = z.object({
  olderThanDays: z.coerce.number().int().min(1).optional(),
  date: z.string().max(32).optional(),
});
