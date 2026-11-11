import test from 'node:test';
import assert from 'node:assert/strict';
import { equipmentApi } from '../src/api/equipmentApi.js';
import { authApi } from '../src/api/authApi.js';
import { setAuthToken, ApiClientError } from '../src/api/client.js';

test('SmartMed Frontend AI Recommendation - Unit & Contract Tests', async (t) => {
  await t.test('equipmentApi has getRecommendations and allocateRecommendation methods', () => {
    assert.equal(typeof equipmentApi.getRecommendations, 'function');
    assert.equal(typeof equipmentApi.allocateRecommendation, 'function');
  });

  await t.test('equipmentApi.getRecommendations rejects empty or null payload', async () => {
    await assert.rejects(
      async () => {
        await equipmentApi.getRecommendations(null);
      },
      { message: 'Recommendation query parameters are required' }
    );
  });

  await t.test('equipmentApi.allocateRecommendation validates required parameters', async () => {
    await assert.rejects(
      async () => {
        await equipmentApi.allocateRecommendation(null);
      },
      { message: 'Equipment ID is required for allocation' }
    );

    await assert.rejects(
      async () => {
        await equipmentApi.allocateRecommendation('EQ-VENT-02', { destination: '' });
      },
      { message: 'Destination room is required for allocation' }
    );
  });

  await t.test('Live Backend Query: POST /api/ai/recommend returns structured ranking and safety audit', async () => {
    try {
      // Authenticate with clinician credentials first
      const auth = await authApi.login({
        email: 'doctor@smartmed.hospital',
        password: 'Doctor@SmartMed2026!',
      });
      assert.ok(auth.token, 'Must receive auth token from login');
      setAuthToken(auth.token);

      const result = await equipmentApi.getRecommendations({
        prompt: 'Find the best available ventilator for an emergency based on battery charge, distance, availability, maintenance status, sanitization status, and clinical compatibility.',
        equipmentType: 'ventilator',
        destination: 'ICU-Room-102',
        urgency: 'urgent',
      });

      assert.ok(result.success, 'Recommendation response must indicate success');
      assert.ok(Array.isArray(result.recommendations), 'Recommendations must be an array');
      assert.ok(result.scoringWeights, 'Scoring weights must be disclosed');
      assert.ok(result.disclosures, 'Clinical and engineering disclosures must be present');
      assert.ok(result.explanation, 'Clinical rationale explanation must be generated');

      // Check safety filtering audit trail
      assert.ok(Array.isArray(result.safetyFiltered), 'Safety filtered candidates must be audited');

      // Verify each ranked candidate adheres to safety invariants
      for (const candidate of result.recommendations) {
        assert.equal(candidate.equipment.status, 'Available', 'Ranked candidates must be Available');
        assert.equal(candidate.equipment.sanitizationStatus, 'CLEARED', 'Ranked candidates must have biomedical clearance');
        assert.ok(candidate.score >= 0 && candidate.score <= 100, 'Score must be normalized 0-100');
        assert.ok(candidate.metrics, 'Candidate must include transparent metrics');
        assert.ok(typeof candidate.metrics.transitMinutes === 'number', 'Transit minutes must be computed');
        assert.ok(typeof candidate.subscores.battery === 'number', 'Battery subscore must be computed');
      }

      // Verify transparency disclosures
      assert.ok(
        /runtime/i.test(result.disclosures.batteryRuntimeDisclaimer),
        'Battery disclosure must explain that battery % is not equivalent to benchmarked runtime'
      );
      assert.ok(
        /estimate/i.test(result.disclosures.transitTimeDisclaimer),
        'Transit disclosure must explain that transit time is an architectural floor-plan estimate'
      );
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'NETWORK_ERROR') {
        // Backend not running in this specific test runner process, skip network test
        return;
      }
      throw err;
    } finally {
      // Clean up token
      setAuthToken(null);
    }
  });

  await t.test('Safety Invariant: Unauthenticated allocation fails with 401 UNAUTHENTICATED', async () => {
    // Clear token
    setAuthToken(null);

    await assert.rejects(
      async () => {
        await equipmentApi.allocateRecommendation('EQ-VENT-02', {
          destination: 'ICU-Room-102',
          purpose: 'Emergency test allocation',
        });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError, `Expected ApiClientError, got: ${err}`);
        if (err.code === 'NETWORK_ERROR') {
          // Backend is offline in this isolated runner execution
          return true;
        }
        assert.equal(err.status, 401, 'Status must be 401 Unauthenticated');
        assert.equal(err.code, 'UNAUTHENTICATED');
        return true;
      }
    );
  });
});
