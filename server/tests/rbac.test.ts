import request from 'supertest';
import app from '../src/app';
import { loginAs } from './helpers';

describe('Role-Based Access Control (RBAC)', () => {
  describe('Unauthenticated Access', () => {
    it('returns 401 for unauthenticated requests to protected customer routes', async () => {
      const res = await request(app).get('/api/users/profile');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not authenticated/i);
    });

    it('returns 401 for unauthenticated requests to admin routes', async () => {
      const res = await request(app).get('/api/admin/coupons');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not authenticated/i);
    });

    it('returns 401 for unauthenticated requests to delivery routes', async () => {
      const res = await request(app).get('/api/delivery/returns');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 for unauthenticated requests to supplier routes', async () => {
      const res = await request(app).get('/api/supplier/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Customer Role Boundaries', () => {
    it('denies customer access to admin coupon endpoints with 403', async () => {
      const { agent } = await loginAs('customer');
      const res = await agent.get('/api/admin/coupons');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/access denied|forbidden|not authorized|permission/i);
    });

    it('denies customer access to staff management endpoints with 403', async () => {
      const { agent } = await loginAs('customer');
      const res = await agent.get('/api/staff');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('denies customer access to delivery return queues with 403', async () => {
      const { agent } = await loginAs('customer');
      const res = await agent.get('/api/delivery/returns');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('denies customer access to supplier portal profile with 403', async () => {
      const { agent } = await loginAs('customer');
      const res = await agent.get('/api/supplier/me');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Privileged Role Access', () => {
    it('allows admin role to access admin coupons', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.get('/api/admin/coupons');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('allows owner role to access admin coupons', async () => {
      const { agent } = await loginAs('owner');
      const res = await agent.get('/api/admin/coupons');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('denies staff role from owner-restricted endpoints with 403', async () => {
      const { agent } = await loginAs('staff');
      // POST /api/staff is restricted to owner
      const res = await agent.post('/api/staff').send({
        name: 'New Staff',
        email: 'staff@example.com',
        role: 'staff',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
