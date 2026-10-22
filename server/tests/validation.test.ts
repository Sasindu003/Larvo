import request from 'supertest';
import app from '../src/app';
import { loginAs } from './helpers';

describe('Payload Validation & Standard Error Envelope', () => {
  it('returns validation error envelope when registration payload is missing required fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Incomplete User',
        // missing email and password
      });

    expect([400, 422]).toContain(res.status);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/validation failed/i);
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.length).toBeGreaterThan(0);

    const emailErr = res.body.errors.find((e: any) => e.field?.includes('email'));
    expect(emailErr).toBeDefined();
  });

  it('returns validation error when email format is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Bad Email Guy',
        email: 'not-an-email',
        password: 'Password123!',
      });

    expect([400, 422]).toContain(res.status);
    expect(res.body.success).toBe(false);
    expect(Array.isArray(res.body.errors)).toBe(true);
    const emailErr = res.body.errors.find((e: any) => e.field?.includes('email'));
    expect(emailErr).toBeDefined();
  });

  it('returns validation error when password is too short', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Short Password Guy',
        email: 'shortpass@example.com',
        password: '123',
      });

    expect([400, 422]).toContain(res.status);
    expect(res.body.success).toBe(false);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  it('returns validation error envelope when coupon creation payload is invalid', async () => {
    const { agent } = await loginAs('admin');
    const res = await agent
      .post('/api/admin/coupons')
      .set('Origin', 'http://localhost:5173')
      .send({
        code: 'A', // too short (< 2 chars)
        discountType: 'unsupported_type',
        discountValue: -50,
      });

    expect([400, 422]).toContain(res.status);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/validation failed/i);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  it('returns 400 INVALID_ID envelope for malformed MongoDB ObjectId params', async () => {
    const { agent } = await loginAs('admin');
    const res = await agent.get('/api/admin/wallets/not-a-valid-object-id');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid.*id|cast/i);
  });
});
