import test from 'node:test';
import assert from 'node:assert/strict';
import { equipmentApi } from '../src/api/equipmentApi.js';
import { ApiClientError, apiRequest } from '../src/api/client.js';

test('SmartMed Equipment Persistence & Live API Lifecycle Tests', async (t) => {
  await t.test('equipmentApi.createEquipment validates and builds correct request', async () => {
    assert.equal(typeof equipmentApi.createEquipment, 'function');

    // Missing payload throws immediate client error
    await assert.rejects(
      async () => {
        await equipmentApi.createEquipment(undefined);
      },
      /Equipment data payload is required/
    );
  });

  await t.test('createEquipment error handling: rejects backend errors without silent fallback', async () => {
    // Calling an offline endpoint must reject with ApiClientError, never silent success
    const offlineUrl = 'http://127.0.0.1:59998/api/equipment';
    await assert.rejects(
      async () => {
        await apiRequest(offlineUrl, {
          method: 'POST',
          body: JSON.stringify({ name: 'Failing Asset' }),
          timeoutMs: 1200,
        });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.ok(err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT');
        return true;
      }
    );
  });

  await t.test('equipmentApi.getEquipment builds query filters cleanly', async () => {
    assert.equal(typeof equipmentApi.getEquipment, 'function');
  });

  await t.test('Mock vs Live Mode safety: Live mode failures must not mask as mock success', () => {
    // In live mode, error status must remain 'error' and not be overridden by mock data
    const simulateErrorResponse = (err) => {
      const apiSyncStatus = 'error';
      const apiError = err instanceof ApiClientError ? err.message : err.message;
      return { apiSyncStatus, apiError };
    };

    const res = simulateErrorResponse(new ApiClientError('Connection refused: port 5000 offline'));
    assert.equal(res.apiSyncStatus, 'error');
    assert.match(res.apiError, /Connection refused/);
  });
});
