import request from 'supertest';
import app from '../src/app';

describe('CSRF Guard Middleware', () => {
  it('blocks state-changing requests with foreign Origin with 403', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://attacker.evil.com')
      .send({
        email: 'test@example.com',
        password: 'Password123!',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/CSRF protection|origin not allowed/i);
  });

  it('allows safe methods (GET) even with foreign Origin', async () => {
    const res = await request(app)
      .get('/api')
      .set('Origin', 'https://attacker.evil.com');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('allows state-changing requests from authorized client origin', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({
        email: 'nobody@example.com',
        password: 'WrongPassword123!',
      });

    // Should NOT be blocked by CSRF (403), but instead reach the controller (401 invalid credentials)
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });
});
