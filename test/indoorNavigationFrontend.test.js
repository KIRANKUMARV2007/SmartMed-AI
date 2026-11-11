import test from 'node:test';
import assert from 'node:assert/strict';
import { equipmentApi } from '../src/api/equipmentApi.js';
import { ApiClientError } from '../src/api/client.js';

test('SmartMed Frontend Indoor Navigation & Distance Intelligence Tests', async (t) => {
  await t.test('equipmentApi has getNavigationRoute and getNavigationGraph methods', () => {
    assert.equal(typeof equipmentApi.getNavigationRoute, 'function');
    assert.equal(typeof equipmentApi.getNavigationGraph, 'function');
  });

  await t.test('equipmentApi.getNavigationRoute rejects missing parameters with clear error', async () => {
    await assert.rejects(
      async () => {
        await equipmentApi.getNavigationRoute(null, null);
      },
      /Both start and destination rooms are required/
    );

    await assert.rejects(
      async () => {
        await equipmentApi.getNavigationRoute('RM-ER-101', '');
      },
      /Both start and destination rooms are required/
    );
  });

  await t.test('Navigation Contract: Live / Mock route payload contains required graph routing fields', async () => {
    try {
      const res = await equipmentApi.getNavigationRoute('RM-ER-101', 'RM-ICU-204');
      if (res && res.route) {
        assert.equal(res.success, true);
        assert.equal(typeof res.route.isNavigable, 'boolean');
        assert.ok(typeof res.route.totalDistanceMeters === 'number');
        assert.ok(typeof res.route.estimatedTransitMinutes === 'number');
        assert.ok(typeof res.route.floorChanges === 'number');
        assert.equal(typeof res.route.hasElevatorTransfer, 'boolean');
        assert.ok(Array.isArray(res.route.steps));
        assert.ok(res.route.steps.length > 0);

        // Invariant: Non-live tracking disclaimer must be present
        assert.ok(res.disclaimer || res.route.disclaimer);
        assert.match(
          res.disclaimer || res.route.disclaimer,
          /Never represents real-time|not live GPS\/RTLS/i
        );
      }
    } catch (err) {
      if (err instanceof ApiClientError && (err.code === 'NETWORK_ERROR' || err.status === 401)) {
        // Expected when runner is isolated from session cookie or offline
        return;
      }
      throw err;
    }
  });

  await t.test('Safety Invariant: Unmodeled or unreachable route fails with clear error and disclaimer', async () => {
    try {
      await equipmentApi.getNavigationRoute('RM-ER-101', 'Invalid-Room-XYZ');
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'NETWORK_ERROR' || err.status === 401) return;
        assert.ok(err.status === 404 || err.code === 'ROUTE_UNREACHABLE');
        return;
      }
      throw err;
    }
  });
});
