import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { JWT_SECRET } from '../src/middleware/auth.js';

const adminToken = jwt.sign(
  {
    id: 'USR-ADMIN-01',
    email: 'admin@smartmed.hospital',
    role: 'admin',
    name: 'Dr. Evelyn Vance',
    department: 'Hospital Administration',
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

describe('SmartMed Route Validation & Guardrails', () => {
  test('POST /api/equipment rejects unauthenticated call with 401', async () => {
    const res = await request(app).post('/api/equipment').send({
      name: 'Partial Ventilator',
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.code, 'UNAUTHENTICATED');
  });

  test('POST /api/equipment rejects incomplete registration with 400 when authenticated', async () => {
    const res = await request(app)
      .post('/api/equipment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Partial Ventilator',
      });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Missing required equipment fields/);
  });

  test('POST /api/equipment rejects missing category with 400 when authenticated', async () => {
    const res = await request(app)
      .post('/api/equipment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Device',
        currentRoom: 'ER-101',
      });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Missing required equipment fields/);
  });

  test('POST /api/equipment rejects missing currentRoom with 400 when authenticated', async () => {
    const res = await request(app)
      .post('/api/equipment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Device',
        category: 'Ventilator',
      });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Missing required equipment fields/);
  });

  test('POST /api/equipment/:id/reserve rejects missing booking params with 400', async () => {
    const res = await request(app)
      .post('/api/equipment/EQ-NONEXISTENT/reserve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Missing required reservation parameters/);
  });

  test('POST /api/equipment/:id/move rejects missing destination room with 400', async () => {
    const res = await request(app)
      .post('/api/equipment/EQ-NONEXISTENT/move')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Destination room .* is required/);
  });

  test('POST /api/movements rejects invalid audit record with 400', async () => {
    const res = await request(app)
      .post('/api/movements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        equipmentId: 'EQ-01',
      });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Missing required audit entry fields/);
  });

  test('POST /api/maintenance rejects missing ticket details with 400', async () => {
    const res = await request(app)
      .post('/api/maintenance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        equipmentId: 'EQ-01',
      });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Missing required maintenance ticket fields/);
  });
});
