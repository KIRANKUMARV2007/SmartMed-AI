import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';

describe('SmartMed API Core Endpoints', () => {
  test('GET /api/health returns health status payload', async () => {
    const res = await request(app).get('/api/health');
    // When no DB is connected, status is 503 degraded, but returns valid diagnostic JSON
    assert.ok(res.status === 200 || res.status === 503);
    assert.equal(res.body.service, 'SmartMed AI Backend API');
    assert.ok(res.body.database);
    assert.equal(typeof res.body.database.connected, 'boolean');
  });

  test('GET /api/unknown-route returns 404 JSON', async () => {
    const res = await request(app).get('/api/unknown-route');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Route not found');
  });
});
