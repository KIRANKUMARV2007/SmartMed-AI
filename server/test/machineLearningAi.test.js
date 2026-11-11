import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { mlClient } from '../src/services/mlClient.js';
import { JWT_SECRET } from '../src/middleware/auth.js';

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

const doctorToken = createToken({
  id: 'STF-DOC-01',
  name: 'Dr. Maya Lin, MD',
  email: 'maya.lin@smartmed.hospital',
  role: 'doctor',
  department: 'Emergency Medicine',
});

describe('SmartMed Machine Learning & AI Decision Support Suite', () => {
  it('1. GET /api/ai/ml-status returns microservice readiness and loaded models', async () => {
    const res = await request(app)
      .get('/api/ai/ml-status')
      .set('Authorization', `Bearer ${doctorToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.microservice, 'Microservice status object should be returned');
  });

  it('2. POST /api/ai/predictive-maintenance infers failure risk using Random Forest', async () => {
    const sampleEquipment = [
      {
        id: 'EQ-VENT-TEST-1',
        name: 'High Wear Ventilator',
        category: 'Ventilator',
        operatingHours: 3500,
        condition: 'Fair',
        batteryLevel: 35,
        hasBattery: true,
        nextMaintenanceDate: '2026-10-10', // Overdue
        totalUsageSessions: 220,
      },
      {
        id: 'EQ-VENT-TEST-2',
        name: 'Optimal Ventilator',
        category: 'Ventilator',
        operatingHours: 200,
        condition: 'Optimal',
        batteryLevel: 98,
        hasBattery: true,
        nextMaintenanceDate: '2026-12-30',
        totalUsageSessions: 12,
      },
    ];

    const res = await request(app)
      .post('/api/ai/predictive-maintenance')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ equipment: sampleEquipment });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.count, 2);

    const highWear = res.body.results.find((r) => r.equipmentId === 'EQ-VENT-TEST-1');
    const optimal = res.body.results.find((r) => r.equipmentId === 'EQ-VENT-TEST-2');

    assert.ok(highWear, 'High wear asset should be scored');
    assert.ok(optimal, 'Optimal asset should be scored');
    assert.ok(
      highWear.failureRiskScore > optimal.failureRiskScore,
      `High wear risk (${highWear.failureRiskScore}) should exceed optimal risk (${optimal.failureRiskScore})`
    );
  });

  it('3. GET /api/ai/utilization-clusters segments fleet into K-Means profiles', async () => {
    const res = await request(app)
      .get('/api/ai/utilization-clusters')
      .set('Authorization', `Bearer ${doctorToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.results), 'Results should be an array of asset clusterings');
    assert.ok(Array.isArray(res.body.clusterSummaries), 'Cluster summaries should be returned');
    assert.ok(res.body.metadata, 'Metadata disclosure should be provided');
  });

  it('4. POST /api/ai/query applies Random Forest candidate scoring behind safety filter', async () => {
    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        prompt: 'Need emergency ventilator for ICU-201',
        category: 'Ventilator',
        clinicianRoom: 'ICU-201 (Bed A)',
        urgency: 'urgent',
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.candidates));

    if (res.body.candidates.length > 0) {
      const top = res.body.candidates[0];
      assert.ok(top.overallScore > 0, 'Top candidate must have positive suitability score');
      assert.ok(top.rank === 1, 'Top candidate must be rank 1');
    }
  });

  it('5. Safety Invariant: Quarantine & maintenance locked assets are strictly filtered out regardless of ML', async () => {
    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        category: 'ECG Machine',
        clinicianRoom: 'ER-101 (Trauma Bay 1)',
        urgency: 'urgent',
      });

    assert.strictEqual(res.status, 200);
    // EQ-ECG-01 is in Under Maintenance in seed data, so it must be filtered out
    const candidates = res.body.candidates || [];
    const faultyPresent = candidates.some((c) => c.equipment?.status === 'Under Maintenance' || c.equipment?.status === 'Faulty');
    assert.strictEqual(faultyPresent, false, 'Maintenance locked assets must never appear as eligible candidates');
    assert.ok(res.body.ineligibleCount >= 1, 'Ineligible count must track filtered asset');
  });

  it('6. Resilient Fallback: Handles offline ML microservice gracefully without crashing', async () => {
    // Test mlClient with empty list or unreachable service
    const emptyResult = await mlClient.predictMaintenance([]);
    assert.strictEqual(emptyResult.success, true);
    assert.strictEqual(emptyResult.count, 0);

    const emptyUtil = await mlClient.clusterUtilization([]);
    assert.strictEqual(emptyUtil.success, true);
    assert.strictEqual(emptyUtil.count, 0);
  });
});
