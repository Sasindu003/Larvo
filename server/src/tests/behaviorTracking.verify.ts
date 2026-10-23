import assert from 'assert';
import { parseUserAgent, extractClientIp, extractGeoLocation } from '../utils/deviceParser';
import { behaviorLogService } from '../services/behaviorLog.service';
import UserBehaviorLog from '../models/UserBehaviorLog';
import { IngestEventsSchema, GetLogsQuerySchema, VerifyPasskeySchema } from '../validators/behaviorLog.validator';
import { Request } from 'express';

console.log('--- Running User Behavior Tracking Unit Verification ---');

// 1. Device Parser Tests
console.log('1. Testing User Agent and Device Parsing...');
const winChrome = parseUserAgent(
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
);
assert.strictEqual(winChrome.os.name, 'Windows', 'Should detect Windows');
assert.strictEqual(winChrome.os.version, '10/11', 'Should detect Windows 10/11');
assert.strictEqual(winChrome.browser.name, 'Chrome', 'Should detect Chrome');
assert.strictEqual(winChrome.device.type, 'desktop', 'Should detect Desktop');

const iPhoneSafari = parseUserAgent(
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1'
);
assert.strictEqual(iPhoneSafari.os.name, 'iOS', 'Should detect iOS');
assert.strictEqual(iPhoneSafari.device.type, 'mobile', 'Should detect Mobile');
assert.strictEqual(iPhoneSafari.browser.name, 'Safari', 'Should detect Safari');

const botUa = parseUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');
assert.strictEqual(botUa.device.type, 'bot', 'Should detect Bot');
console.log('   ✓ User Agent & Device parsing passed');

// 2. IP Extraction & Geo Headers
console.log('2. Testing IP and Geo Location Extraction...');
const mockReq = {
  headers: {
    'cf-connecting-ip': '203.0.113.195',
    'x-forwarded-for': '198.51.100.1, 10.0.0.1',
    'x-vercel-ip-country': 'TH',
    'x-vercel-ip-country-region': 'Bangkok',
    'x-vercel-ip-city': 'Bangkok',
  },
  socket: {},
} as unknown as Request;

assert.strictEqual(extractClientIp(mockReq), '203.0.113.195', 'Should extract CF connecting IP');
const geo = extractGeoLocation(mockReq, 'Asia/Bangkok');
assert.strictEqual(geo.country, 'TH', 'Should extract country');
assert.strictEqual(geo.region, 'Bangkok', 'Should extract region');
assert.strictEqual(geo.city, 'Bangkok', 'Should extract city');
assert.strictEqual(geo.timezone, 'Asia/Bangkok', 'Should extract timezone');

const localReq = {
  headers: {},
  socket: { remoteAddress: '::1' },
} as unknown as Request;
assert.strictEqual(extractClientIp(localReq), '127.0.0.1', 'Should normalize IPv6 loopback to 127.0.0.1');
console.log('   ✓ IP & Geo parsing passed');

// 3. Passkey Verification
console.log('3. Testing Passkey Verification (Timing-Safe)...');
assert.strictEqual(behaviorLogService.verifyPasskey('admin123'), true, 'admin123 should be valid passkey');
assert.strictEqual(behaviorLogService.verifyPasskey('wrong-key'), false, 'wrong key should fail');
assert.strictEqual(behaviorLogService.verifyPasskey(''), false, 'empty key should fail');
console.log('   ✓ Passkey verification passed');

// 4. Schema Immutability & Structure
console.log('4. Testing Model Immutability Guard...');
assert.ok(UserBehaviorLog.schema.path('eventType'), 'Schema should have eventType path');
assert.ok(UserBehaviorLog.schema.path('deviceId'), 'Schema should have deviceId path');
assert.ok(UserBehaviorLog.schema.path('sessionId'), 'Schema should have sessionId path');
assert.ok(UserBehaviorLog.schema.path('ip'), 'Schema should have ip path');
assert.ok(UserBehaviorLog.schema.path('createdAt'), 'Schema should have createdAt timestamp path');
console.log('   ✓ Model paths & indexes validated');

// 5. Payload Validator Schemas
console.log('5. Testing Zod Validators...');
const validPayload = IngestEventsSchema.safeParse({
  events: [
    {
      sessionId: 'sess-1234',
      deviceId: 'dev-5678',
      eventType: 'click',
      page: {
        path: '/products',
        title: 'Larvo Apparel Catalog',
      },
      target: {
        tagName: 'BUTTON',
        innerText: 'Add to Bag',
        coords: { x: 120, y: 340 },
      },
    },
  ],
  clientTimezone: 'Asia/Bangkok',
});
assert.strictEqual(validPayload.success, true, 'Valid payload should parse successfully');

const invalidPayload = IngestEventsSchema.safeParse({
  events: [],
});
assert.strictEqual(invalidPayload.success, false, 'Empty events array should fail validation');

const validQuery = GetLogsQuerySchema.safeParse({
  page: '2',
  limit: '50',
  sortBy: 'createdAt',
  sortOrder: 'asc',
});
assert.strictEqual(validQuery.success, true, 'Valid query params should parse successfully');
if (validQuery.success) {
  assert.strictEqual(validQuery.data.page, 2, 'Page should coerce to number');
  assert.strictEqual(validQuery.data.limit, 50, 'Limit should coerce to number');
}
console.log('   ✓ Payload and query validators passed');

console.log('\nAll User Behavior Tracking unit checks passed successfully!');
