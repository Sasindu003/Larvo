import request from 'supertest';
import app from '../src/app';
import User from '../src/models/User';
import { createUser, DEFAULT_TEST_PASSWORD } from './helpers';

describe('Authentication & Registration Flow', () => {
  describe('POST /api/auth/register', () => {
    it('registers a new customer successfully', async () => {
      const email = `newuser-${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alice Wonderland',
          email,
          password: 'Password123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(email);
      expect(res.body.data.user.role).toBe('customer');

      // Verify passwordHash is never returned in response
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.password).toBeUndefined();

      // Verify persistence in DB
      const dbUser = await User.findOne({ email }).select('+passwordHash');
      expect(dbUser).toBeDefined();
      expect(dbUser?.passwordHash).toBeDefined();
      expect(dbUser?.passwordHash).not.toBe('Password123!');
    });

    it('ignores role submitted in body and defaults to customer', async () => {
      const email = `tryadmin-${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Hacker User',
          email,
          password: 'Password123!',
          role: 'admin', // Privilege escalation attempt
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('customer');

      const dbUser = await User.findOne({ email });
      expect(dbUser?.role).toBe('customer');
    });

    it('returns 409 when registering with an existing email', async () => {
      const existingUser = await createUser('customer');

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Duplicate Guy',
          email: existingUser.email,
          password: 'Password123!',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });
  });

  describe('POST /api/auth/login', () => {
    it('authenticates valid credentials and sets auth cookie', async () => {
      const user = await createUser('customer');

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: DEFAULT_TEST_PASSWORD,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(user.email);
      expect(res.body.data.user.passwordHash).toBeUndefined();

      // Check cookie header
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      const sltCookie = cookies.find((c: string) => c.startsWith('slt='));
      expect(sltCookie).toBeDefined();
      expect(sltCookie).toMatch(/HttpOnly/i);
    });

    it('returns identical error for wrong password and unknown email (no enumeration)', async () => {
      const user = await createUser('customer');

      // Wrong password
      const wrongPassRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: 'WrongPassword123!',
        });

      // Unknown email
      const unknownEmailRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent-user-999@example.com',
          password: 'Password123!',
        });

      expect(wrongPassRes.status).toBe(401);
      expect(unknownEmailRes.status).toBe(401);
      expect(wrongPassRes.body.success).toBe(false);
      expect(unknownEmailRes.body.success).toBe(false);

      // Error message must be identical to prevent email enumeration
      expect(wrongPassRes.body.message).toBe(unknownEmailRes.body.message);
      expect(wrongPassRes.body.message).toMatch(/invalid credentials/i);
    });

    it('rejects deactivated account with 403', async () => {
      const user = await createUser('customer', { active: false });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: DEFAULT_TEST_PASSWORD,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/deactivated/i);
    });
  });
});
