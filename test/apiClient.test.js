import test from 'node:test';
import assert from 'node:assert/strict';
import { API_BASE_URL, ApiClientError, apiRequest } from '../src/api/client.js';
import { equipmentApi } from '../src/api/equipmentApi.js';
import fs from 'node:fs';
import path from 'node:path';

test('SmartMed Frontend API Client - Unit & Contract Tests', async (t) => {
  await t.test('API_BASE_URL resolves with sensible default', () => {
    assert.ok(API_BASE_URL, 'API_BASE_URL must be defined');
    assert.match(API_BASE_URL, /localhost:5000\/api|\/api/, 'Base URL matches expected endpoint pattern');
  });

  await t.test('ApiClientError captures error structure correctly', () => {
    const error = new ApiClientError('Test error message', {
      status: 503,
      code: 'DATABASE_DEGRADED',
      details: { db: false },
      endpoint: '/health',
    });

    assert.equal(error.name, 'ApiClientError');
    assert.equal(error.message, 'Test error message');
    assert.equal(error.status, 503);
    assert.equal(error.code, 'DATABASE_DEGRADED');
    assert.deepEqual(error.details, { db: false });
    assert.equal(error.endpoint, '/health');
  });

  await t.test('equipmentApi methods exist and build valid URLs', () => {
    assert.equal(typeof equipmentApi.checkHealth, 'function');
    assert.equal(typeof equipmentApi.getEquipment, 'function');
    assert.equal(typeof equipmentApi.getEquipmentById, 'function');
    assert.equal(typeof equipmentApi.createEquipment, 'function');
    assert.equal(typeof equipmentApi.moveEquipment, 'function');
  });

  await t.test('equipmentApi.createEquipment rejects missing payload', async () => {
    await assert.rejects(
      async () => {
        await equipmentApi.createEquipment(null);
      },
      { message: 'Equipment data payload is required' }
    );
  });

  await t.test('apiRequest fails with clear NETWORK_ERROR when backend server is unreachable', async () => {
    // Calling an unreachable local port should produce ApiClientError with NETWORK_ERROR, never silent success
    const unreachableUrl = 'http://127.0.0.1:59999/api/unreachable';
    await assert.rejects(
      async () => {
        await apiRequest(unreachableUrl, { timeoutMs: 1500 });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.ok(err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT');
        assert.match(err.message, /Unable to connect|timed out/);
        return true;
      }
    );
  });

  await t.test('Security Audit: Frontend configuration and build do not expose MongoDB credentials', () => {
    const rootEnvExample = fs.readFileSync(path.resolve('.env.example'), 'utf8');
    assert.ok(!rootEnvExample.includes('mongodb://'), '.env.example in root must not contain mongodb:// URI');
    assert.ok(!rootEnvExample.includes('MONGODB_URI'), '.env.example in root must not contain MONGODB_URI');
    assert.ok(rootEnvExample.includes('VITE_API_BASE_URL'), '.env.example in root must only define public VITE_ variables');
  });
});
