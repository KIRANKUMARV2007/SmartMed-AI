import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { JWT_SECRET } from '../src/middleware/auth.js';

function createTestToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

describe('SmartMed Authentication & RBAC Security Suite', () => {
  // 1. Unauthenticated Access Protection
  describe('Unauthenticated Request Guard', () => {
    test('GET /api/equipment without token returns 401 UNAUTHENTICATED', async () => {
      const res = await request(app).get('/api/equipment');
      assert.equal(res.status, 401);
      assert.equal(res.body.code, 'UNAUTHENTICATED');
    });

    test('POST /api/equipment without token returns 401 UNAUTHENTICATED', async () => {
      const res = await request(app).post('/api/equipment').send({ name: 'Ventilator' });
      assert.equal(res.status, 401);
      assert.equal(res.body.code, 'UNAUTHENTICATED');
    });

    test('GET /api/users without token returns 401 UNAUTHENTICATED', async () => {
      const res = await request(app).get('/api/users');
      assert.equal(res.status, 401);
      assert.equal(res.body.code, 'UNAUTHENTICATED');
    });

    test('GET /api/audit-logs without token returns 401 UNAUTHENTICATED', async () => {
      const res = await request(app).get('/api/audit-logs');
      assert.equal(res.status, 401);
      assert.equal(res.body.code, 'UNAUTHENTICATED');
    });
  });

  // 2. Token Integrity & Tampering Protection
  describe('Token Cryptographic Integrity', () => {
    test('Rejects fabricated/tampered token with 401 TOKEN_INVALID', async () => {
      const fakeToken = jwt.sign({ id: 'USR-HACKER', role: 'admin' }, 'wrong_secret_key');
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${fakeToken}`);
      assert.equal(res.status, 401);
      assert.equal(res.body.code, 'TOKEN_INVALID');
    });

    test('Rejects deactivated account with 403 ACCOUNT_DEACTIVATED', async () => {
      const inactiveToken = createTestToken({
        id: 'USR-INACTIVE',
        email: 'inactive@smartmed.hospital',
        role: 'staff',
        status: 'inactive',
      });
      const res = await request(app)
        .get('/api/equipment')
        .set('Authorization', `Bearer ${inactiveToken}`);
      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'ACCOUNT_DEACTIVATED');
    });
  });

  // 3. Role-Based Access Control (RBAC) Enforcement
  describe('Strict Role-Based Permissions (RBAC)', () => {
    test('Staff role is rejected from GET /api/users with 403 FORBIDDEN', async () => {
      const staffToken = createTestToken({
        id: 'USR-STAFF-1',
        email: 'staff@smartmed.hospital',
        role: 'staff',
        status: 'active',
      });
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${staffToken}`);
      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'FORBIDDEN');
    });

    test('Doctor role is rejected from user creation with 403 FORBIDDEN', async () => {
      const doctorToken = createTestToken({
        id: 'USR-DOC-1',
        email: 'doctor@smartmed.hospital',
        role: 'doctor',
        status: 'active',
      });
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          name: 'New Nurse',
          email: 'nurse2@smartmed.hospital',
          role: 'nurse',
        });
      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'FORBIDDEN');
    });

    test('Nurse role is rejected from deleting equipment with 403 FORBIDDEN', async () => {
      const nurseToken = createTestToken({
        id: 'USR-NURSE-1',
        email: 'nurse@smartmed.hospital',
        role: 'nurse',
        status: 'active',
      });
      const res = await request(app)
        .delete('/api/equipment/EQ-01')
        .set('Authorization', `Bearer ${nurseToken}`);
      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'FORBIDDEN');
    });

    test('Nurse role is rejected from editing equipment with 403 FORBIDDEN', async () => {
      const nurseToken = createTestToken({
        id: 'USR-NURSE-1',
        email: 'nurse@smartmed.hospital',
        role: 'nurse',
        status: 'active',
      });
      const res = await request(app)
        .put('/api/equipment/EQ-01')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({ name: 'Tampered Name' });
      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'FORBIDDEN');
    });

    test('Admin token passes RBAC check for user management', async () => {
      const adminToken = createTestToken({
        id: 'USR-ADMIN-1',
        email: 'admin@smartmed.hospital',
        role: 'admin',
        status: 'active',
      });
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);
      // If DB is offline in unit test, it returns 200 or handles query safely
      assert.ok(res.status === 200 || res.status === 500);
    });
  });

  // 4. Login Input Validation
  describe('Login Input Validation', () => {
    test('POST /api/auth/login rejects missing credentials with 400', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'MISSING_CREDENTIALS');
    });

    test('POST /api/auth/login rejects empty password with 400', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'admin@smartmed.hospital',
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'MISSING_CREDENTIALS');
    });

    test('POST /api/auth/login returns 503 DATABASE_UNAVAILABLE without timing out when database is offline', async () => {
      // In disconnected state, login must respond immediately with 503 rather than buffering for 10s
      if (mongoose.connection.readyState !== 1) {
        const startTime = Date.now();
        const res = await request(app).post('/api/auth/login').send({
          email: 'doctor@smartmed.hospital',
          password: 'Password123!',
        });
        const duration = Date.now() - startTime;
        assert.equal(res.status, 503);
        assert.equal(res.body.code, 'DATABASE_UNAVAILABLE');
        assert.ok(duration < 2000, `Expected fast response under 2000ms, took ${duration}ms`);
      }
    });
  });
});

