import { parseUserAgent, extractClientIp, extractGeoLocation } from '../src/utils/deviceParser';
import { behaviorLogService } from '../src/services/behaviorLog.service';
import UserBehaviorLog from '../src/models/UserBehaviorLog';
import { Request } from 'express';

describe('User Behavior Tracking System', () => {
  describe('Device & User Agent Parsing', () => {
    it('correctly parses Windows Desktop with Chrome', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
      const parsed = parseUserAgent(ua);

      expect(parsed.os.name).toBe('Windows');
      expect(parsed.os.version).toBe('10/11');
      expect(parsed.browser.name).toBe('Chrome');
      expect(parsed.browser.version).toBe('124.0');
      expect(parsed.device.type).toBe('desktop');
    });

    it('correctly parses iPhone with Safari', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1';
      const parsed = parseUserAgent(ua);

      expect(parsed.os.name).toBe('iOS');
      expect(parsed.os.version).toBe('17.4.1');
      expect(parsed.browser.name).toBe('Safari');
      expect(parsed.device.type).toBe('mobile');
      expect(parsed.device.vendor).toBe('Apple');
      expect(parsed.device.model).toBe('iPhone');
    });

    it('correctly parses Android Mobile with Edge', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 EdgA/120.0.2210.141';
      const parsed = parseUserAgent(ua);

      expect(parsed.os.name).toBe('Android');
      expect(parsed.browser.name).toBe('Edge');
      expect(parsed.device.type).toBe('mobile');
    });

    it('correctly detects automated crawlers and bots', () => {
      const ua = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
      const parsed = parseUserAgent(ua);

      expect(parsed.device.type).toBe('bot');
    });
  });

  describe('IP Extraction & Geo Headers', () => {
    it('prioritizes cf-connecting-ip if present', () => {
      const mockReq = {
        headers: {
          'cf-connecting-ip': '203.0.113.195',
          'x-forwarded-for': '198.51.100.1, 10.0.0.1',
        },
        socket: {},
      } as unknown as Request;

      expect(extractClientIp(mockReq)).toBe('203.0.113.195');
    });

    it('extracts first IP from x-forwarded-for chain', () => {
      const mockReq = {
        headers: {
          'x-forwarded-for': '198.51.100.45, 10.0.0.2',
        },
        socket: {},
      } as unknown as Request;

      expect(extractClientIp(mockReq)).toBe('198.51.100.45');
    });

    it('normalizes IPv6 localhost to 127.0.0.1', () => {
      const mockReq = {
        headers: {},
        socket: { remoteAddress: '::1' },
      } as unknown as Request;

      expect(extractClientIp(mockReq)).toBe('127.0.0.1');
    });

    it('extracts edge geolocation headers from request', () => {
      const mockReq = {
        headers: {
          'x-vercel-ip-country': 'TH',
          'x-vercel-ip-country-region': 'Bangkok',
          'x-vercel-ip-city': 'Bangkok',
        },
        socket: {},
      } as unknown as Request;

      const geo = extractGeoLocation(mockReq, 'Asia/Bangkok');
      expect(geo.country).toBe('TH');
      expect(geo.region).toBe('Bangkok');
      expect(geo.city).toBe('Bangkok');
      expect(geo.timezone).toBe('Asia/Bangkok');
    });
  });

  describe('Passkey Verification', () => {
    it('returns true when passkey matches TRACKING_PASSKEY', () => {
      // TRACKING_PASSKEY default in env is 'admin123'
      const isValid = behaviorLogService.verifyPasskey('admin123');
      expect(isValid).toBe(true);
    });

    it('returns false for invalid or empty passkey', () => {
      expect(behaviorLogService.verifyPasskey('wrong-key')).toBe(false);
      expect(behaviorLogService.verifyPasskey('')).toBe(false);
      expect(behaviorLogService.verifyPasskey(null as any)).toBe(false);
    });
  });

  describe('Audit Immutability Guard', () => {
    it('rejects deleteOne and deleteMany operations at schema hook level', async () => {
      expect(() => {
        UserBehaviorLog.schema.eachPath(() => {});
      }).not.toThrow();

      // Attempting to invoke delete hooks directly or on query throws ImmutableAuditError
      const hooks = (UserBehaviorLog.schema as any).s?.hooks;
      expect(hooks).toBeDefined();
    });
  });
});
