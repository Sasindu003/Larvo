import request from 'supertest';
import app from '../src/app';
import { loginAs } from './helpers';

describe('Health & Liveness Probes', () => {
  it('GET /api/health returns 200 OK with liveness status and uptime', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ok).toBe(true);
    expect(typeof res.body.data.uptime).toBe('number');
  });

  it('GET /api/health/ready returns 200 OK when database is connected', async () => {
    const res = await request(app).get('/api/health/ready');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ready).toBe(true);
    expect(res.body.data.db).toBe('connected');
  });

  it('GET /api/health/detail denies non-admin users with 401 or 403', async () => {
    // Unauthenticated
    const unauthRes = await request(app).get('/api/health/detail');
    expect(unauthRes.status).toBe(401);

    // Customer
    const { agent: customerAgent } = await loginAs('customer');
    const custRes = await customerAgent.get('/api/health/detail');
    expect(custRes.status).toBe(403);
  });

  it('GET /api/health/detail returns full system details for admin users', async () => {
    const { agent: adminAgent } = await loginAs('admin');
    const res = await adminAgent.get('/api/health/detail');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.db).toBe('connected');
    expect(res.body.data.uptime).toBeDefined();
    expect(res.body.data.memoryUsage).toBeDefined();
    expect(res.body.data.nodeVersion).toBeDefined();
  });
});
