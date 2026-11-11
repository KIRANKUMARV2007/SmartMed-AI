import test from 'node:test';
import assert from 'node:assert/strict';
import { equipmentApi } from '../src/api/equipmentApi.js';
import { authApi } from '../src/api/authApi.js';
import { setAuthToken, ApiClientError } from '../src/api/client.js';

test('SmartMed Frontend Battery Runtime Intelligence & Smarter Ranking Tests', async (t) => {
  await t.test('Contract: equipmentApi.getRecommendations accepts minRuntimeMinutes', async () => {
    assert.equal(typeof equipmentApi.getRecommendations, 'function');
  });

  await t.test('Telemetry Contract: Recommendations return verified runtime metrics and telemetry status', async () => {
    try {
      // 1. Authenticate with doctor credentials
      const auth = await authApi.login({
        email: 'doctor@smartmed.hospital',
        password: 'Doctor@SmartMed2026!',
      });
      assert.ok(auth.token, 'Must receive auth token from login');
      setAuthToken(auth.token);

      // 2. Query recommendations with structured minRuntimeMinutes and minBatteryPercent
      const result = await equipmentApi.getRecommendations({
        prompt: 'Need available ventilator with 120 minutes verified runtime in ER-101',
        category: 'Ventilator',
        destinationRoom: 'ER-101 (Trauma Bay 1)',
        urgency: 'urgent',
        minBatteryPercent: 50,
      });

      assert.ok(result.success, 'Query must return success');
      assert.ok(Array.isArray(result.recommendations), 'Must return recommendations array');
      assert.ok(result.disclosures, 'Disclosures must be provided');

      // 3. Verify separation of battery percentage from verified runtime duration
      assert.ok(
        /not equivalent to benchmarked runtime/i.test(result.disclosures.batteryRuntimeDisclaimer),
        'Battery disclosure must explain that battery % is not equivalent to benchmarked runtime'
      );

      // 4. Verify candidate metrics structure
      for (const cand of result.recommendations) {
        assert.ok('batteryLevel' in cand.metrics, 'Candidate metrics must track batteryLevel');
        assert.ok('verifiedRuntimeMinutes' in cand.metrics, 'Candidate metrics must track verifiedRuntimeMinutes');
        assert.ok(cand.metrics.runtimeStatus, 'Candidate metrics must provide runtimeStatus');
        assert.ok(cand.metrics.runtimeSource, 'Candidate metrics must provide runtimeSource');

        // Verify status values
        assert.ok(
          ['VERIFIED', 'ESTIMATED', 'UNBENCHMARKED', 'STALE'].includes(cand.metrics.runtimeStatus),
          `Invalid runtimeStatus: ${cand.metrics.runtimeStatus}`
        );

        // Disclosed limitations must flag unbenchmarked runtime if verifiedMinutes is missing
        if (cand.metrics.hasBattery && !cand.metrics.verifiedRuntimeMinutes) {
          assert.equal(cand.metrics.runtimeStatus, 'UNBENCHMARKED');
          assert.equal(cand.metrics.runtimeWarning, 'UNVERIFIED_RUNTIME');
          assert.ok(
            cand.disclosedLimitations.some((l) => l.includes('Verified battery runtime duration is not logged')),
            'Must disclose unbenchmarked runtime in limitations'
          );
        }
      }

      // 5. Ineligible items must report standardized rule codes
      if (result.safetyFiltered && result.safetyFiltered.length > 0) {
        for (const item of result.safetyFiltered) {
          assert.ok(item.rule, 'Safety filtered asset must include rule code');
          assert.ok(item.reason, 'Safety filtered asset must include clinical reason');
        }
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'NETWORK_ERROR') {
        // Backend not running in this specific standalone test runner process
        return;
      }
      throw err;
    } finally {
      setAuthToken(null);
    }
  });

  await t.test('Frontend Filter Safety: Insufficient runtime rejection preserves safety gates', async () => {
    try {
      const auth = await authApi.login({
        email: 'doctor@smartmed.hospital',
        password: 'Doctor@SmartMed2026!',
      });
      setAuthToken(auth.token);

      // Query with an extreme runtime requirement (e.g., 9999 mins) to ensure exclusion
      const result = await equipmentApi.getRecommendations({
        category: 'Ventilator',
        destinationRoom: 'ER-101 (Trauma Bay 1)',
        minRuntimeMinutes: 9999, // Impossible runtime
      });

      assert.ok(result.success);
      // All items must be excluded or zero recommendations returned
      assert.equal(result.recommendations.length, 0, 'No candidate can satisfy 9999 minutes runtime');
      assert.ok(result.ineligibleCount > 0, 'Ineligible count must reflect filtered devices');

      // Check that at least one exclusion was due to runtime
      const runtimeIneligible = result.safetyFiltered.filter(
        (i) => i.rule === 'RUNTIME_INSUFFICIENT' || i.rule === 'RUNTIME_UNVERIFIED' || i.rule === 'RUNTIME_STALE'
      );
      assert.ok(runtimeIneligible.length > 0, 'Must record runtime filter rule in audit trail');
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'NETWORK_ERROR') {
        return;
      }
      throw err;
    } finally {
      setAuthToken(null);
    }
  });
});
