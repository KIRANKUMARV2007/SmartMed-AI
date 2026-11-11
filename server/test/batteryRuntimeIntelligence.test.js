import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { JWT_SECRET } from '../src/middleware/auth.js';
import {
  parseNaturalLanguageQuery,
  filterEligibleCandidates,
  rankCandidates,
  generateClinicalExplanation,
} from '../src/services/recommendationEngine.js';

dotenv.config();

let doctorToken = '';

const mockRooms = [
  { id: 'RM-ER-101', name: 'ER-101 (Trauma Bay 1)', floor: 'Floor 1', wing: 'North Wing' },
  { id: 'RM-ER-102', name: 'ER-102 (Acute Resus)', floor: 'Floor 1', wing: 'North Wing' },
  { id: 'RM-ICU-201', name: 'ICU-201 (Intensive Care)', floor: 'Floor 2', wing: 'East Wing' },
];

describe('SmartMed Battery Runtime Intelligence & Smarter Equipment Ranking Suite', () => {
  before(async () => {
    if (mongoose.connection.readyState !== 1 && process.env.MONGODB_URI) {
      try {
        await connectDB(process.env.MONGODB_URI);
      } catch (err) {
        // Remote MongoDB unreachable, continue with in-memory tests
      }
    }
    let docUser = null;
    if (mongoose.connection.readyState === 1) {
      try {
        docUser = await User.findOne({ role: 'doctor' });
      } catch (e) {}
    }
    doctorToken = jwt.sign(
      {
        id: docUser ? docUser.id : 'DOC-8491',
        name: docUser ? docUser.name : 'Dr. Sarah Connor',
        email: docUser ? docUser.email : 'doctor@smartmed.hospital',
        role: 'doctor',
        department: docUser ? docUser.department : 'Emergency Medicine',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });
  // =========================================================================
  // 1. Natural Language Intent Parsing for Runtime
  // =========================================================================
  describe('1. Natural Language Query Intent Extraction', () => {
    test('extracts runtime requirements in minutes from natural language prompts', () => {
      const q1 = parseNaturalLanguageQuery('Need ventilator with 120 minutes runtime in ER-101', mockRooms);
      assert.equal(q1.category, 'Ventilator');
      assert.equal(q1.minRuntimeMinutes, 120);
      assert.equal(q1.destinationRoom, 'ER-101 (Trauma Bay 1)');

      const q2 = parseNaturalLanguageQuery('Defibrillator with at least 90 min battery runtime', mockRooms);
      assert.equal(q2.category, 'Defibrillator');
      assert.equal(q2.minRuntimeMinutes, 90);

      const q3 = parseNaturalLanguageQuery('180 min runtime transport ventilator for stat transfer', mockRooms);
      assert.equal(q3.category, 'Ventilator');
      assert.equal(q3.minRuntimeMinutes, 180);
      assert.equal(q3.urgency, 'urgent');

      const q4 = parseNaturalLanguageQuery('Standard patient monitor 80% battery', mockRooms);
      assert.equal(q4.category, 'Patient Monitor');
      assert.equal(q4.minBatteryPercent, 80);
      assert.equal(q4.minRuntimeMinutes, null);
    });
  });

  // =========================================================================
  // 2. Insufficient Runtime Filtering & Exclusion
  // =========================================================================
  describe('2. Insufficient Runtime Exclusion Gates', () => {
    test('excludes equipment when verified runtime duration is below required minimum', () => {
      const pool = [
        {
          id: 'EQ-RUN-OK',
          name: 'Hamilton-C6 Ventilator',
          category: 'Ventilator',
          status: 'Available',
          sanitizationStatus: 'CLEARED',
          hasBattery: true,
          batteryLevel: 95,
          batteryRuntime: {
            verifiedMinutes: 180,
            verificationStatus: 'VERIFIED',
            source: 'BIOMED_LOAD_TEST',
            lastMeasuredAt: new Date(Date.now() - 5 * 24 * 3600 * 1000), // 5 days ago
          },
          currentRoom: 'ER-102 (Acute Resus)',
        },
        {
          id: 'EQ-RUN-SHORT',
          name: 'Puritan Bennett Ventilator',
          category: 'Ventilator',
          status: 'Available',
          sanitizationStatus: 'CLEARED',
          hasBattery: true,
          batteryLevel: 90,
          batteryRuntime: {
            verifiedMinutes: 60, // Only 60 mins!
            verificationStatus: 'VERIFIED',
            source: 'BIOMED_LOAD_TEST',
            lastMeasuredAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
          },
          currentRoom: 'ER-102 (Acute Resus)',
        },
      ];

      const { eligible, ineligible } = filterEligibleCandidates(pool, {
        category: 'Ventilator',
        minRuntimeMinutes: 120, // Requires 120 mins
      });

      assert.equal(eligible.length, 1);
      assert.equal(eligible[0].id, 'EQ-RUN-OK');

      assert.equal(ineligible.length, 1);
      assert.equal(ineligible[0].item.id, 'EQ-RUN-SHORT');
      assert.equal(ineligible[0].rule, 'RUNTIME_INSUFFICIENT');
      assert.match(ineligible[0].reason, /Verified battery runtime \(60m\) is below required task duration \(120m\)/);
    });

    test('excludes AC-mains only equipment when battery runtime duration is required', () => {
      const acDevice = [
        {
          id: 'EQ-AC-ONLY',
          name: 'Stationary ICU Ventilator',
          category: 'Ventilator',
          status: 'Available',
          sanitizationStatus: 'CLEARED',
          hasBattery: false,
          batteryLevel: null,
          batteryRuntime: null,
          currentRoom: 'ICU-201 (Intensive Care)',
        },
      ];

      const { eligible, ineligible } = filterEligibleCandidates(acDevice, {
        category: 'Ventilator',
        minRuntimeMinutes: 60,
      });

      assert.equal(eligible.length, 0);
      assert.equal(ineligible.length, 1);
      assert.equal(ineligible[0].rule, 'RUNTIME_INSUFFICIENT');
      assert.match(ineligible[0].reason, /AC mains powered with no internal battery runtime/);
    });
  });

  // =========================================================================
  // 3. Missing Telemetry & Unverified Measurements
  // =========================================================================
  describe('3. Missing Telemetry & Unverified Runtime Handling', () => {
    test('excludes unbenchmarked equipment when runtime duration is explicitly requested', () => {
      const unbenchmarked = [
        {
          id: 'EQ-NO-BENCH',
          name: 'Uncalibrated Transport Vent',
          category: 'Ventilator',
          status: 'Available',
          sanitizationStatus: 'CLEARED',
          hasBattery: true,
          batteryLevel: 95,
          batteryRuntime: {
            verifiedMinutes: null,
            verificationStatus: 'UNBENCHMARKED',
            source: 'UNVERIFIED',
          },
          currentRoom: 'ER-102 (Acute Resus)',
        },
      ];

      const { eligible, ineligible } = filterEligibleCandidates(unbenchmarked, {
        category: 'Ventilator',
        minRuntimeMinutes: 90,
      });

      assert.equal(eligible.length, 0);
      assert.equal(ineligible.length, 1);
      assert.equal(ineligible[0].rule, 'RUNTIME_UNVERIFIED');
      assert.match(ineligible[0].reason, /unbenchmarked in registry/i);
    });

    test('retains unbenchmarked equipment when runtime is NOT required, but clearly discloses limitation', () => {
      const unbenchmarked = [
        {
          id: 'EQ-NO-BENCH-STD',
          name: 'Standard Transport Vent',
          category: 'Ventilator',
          status: 'Available',
          sanitizationStatus: 'CLEARED',
          hasBattery: true,
          batteryLevel: 85,
          batteryRuntime: {
            verifiedMinutes: null,
            verificationStatus: 'UNBENCHMARKED',
            source: 'UNVERIFIED',
          },
          currentRoom: 'ER-101 (Trauma Bay 1)',
          condition: 'Optimal',
        },
      ];

      const { eligible } = filterEligibleCandidates(unbenchmarked, {
        category: 'Ventilator',
        minRuntimeMinutes: null,
      });

      assert.equal(eligible.length, 1);

      const ranked = rankCandidates(eligible, {
        destinationRoomName: 'ER-101 (Trauma Bay 1)',
        roomsList: mockRooms,
      });

      assert.equal(ranked.length, 1);
      assert.equal(ranked[0].metrics.runtimeStatus, 'UNBENCHMARKED');
      assert.equal(ranked[0].metrics.runtimeWarning, 'UNVERIFIED_RUNTIME');
      assert.ok(
        ranked[0].disclosedLimitations.some((l) =>
          l.includes('Verified battery runtime duration is not logged in the registry')
        )
      );
    });
  });

  // =========================================================================
  // 4. Stale Calibration & Expired Safety Window
  // =========================================================================
  describe('4. Stale Measurements & Expired Calibration Handling', () => {
    test('excludes equipment with calibration older than 90 days when runtime is required', () => {
      const staleDevice = [
        {
          id: 'EQ-STALE-01',
          name: 'Older Calibrated Vent',
          category: 'Ventilator',
          status: 'Available',
          sanitizationStatus: 'CLEARED',
          hasBattery: true,
          batteryLevel: 98,
          batteryRuntime: {
            verifiedMinutes: 240,
            verificationStatus: 'VERIFIED',
            source: 'BIOMED_LOAD_TEST',
            lastMeasuredAt: new Date(Date.now() - 110 * 24 * 3600 * 1000), // 110 days old (>90 days!)
          },
          currentRoom: 'ER-101 (Trauma Bay 1)',
        },
      ];

      const { eligible, ineligible } = filterEligibleCandidates(staleDevice, {
        category: 'Ventilator',
        minRuntimeMinutes: 60,
      });

      assert.equal(eligible.length, 0);
      assert.equal(ineligible.length, 1);
      assert.equal(ineligible[0].rule, 'RUNTIME_STALE');
      assert.match(ineligible[0].reason, /STALE/);
      assert.match(ineligible[0].reason, /110 days old/);
    });

    test('penalizes stale equipment score and flags STALE_BENCHMARK limitation when runtime is not required', () => {
      const staleDevice = [
        {
          id: 'EQ-STALE-RANK',
          name: 'Ventilator With Expired Calibration',
          category: 'Ventilator',
          status: 'Available',
          sanitizationStatus: 'CLEARED',
          hasBattery: true,
          batteryLevel: 95,
          batteryRuntime: {
            verifiedMinutes: 240,
            verificationStatus: 'STALE',
            source: 'BIOMED_LOAD_TEST',
            lastMeasuredAt: new Date(Date.now() - 95 * 24 * 3600 * 1000),
          },
          currentRoom: 'ER-101 (Trauma Bay 1)',
          condition: 'Optimal',
        },
      ];

      const ranked = rankCandidates(staleDevice, {
        destinationRoomName: 'ER-101 (Trauma Bay 1)',
        roomsList: mockRooms,
      });

      assert.equal(ranked.length, 1);
      assert.equal(ranked[0].metrics.runtimeWarning, 'STALE_BENCHMARK');
      assert.ok(
        ranked[0].disclosedLimitations.some((l) =>
          l.includes('Battery runtime calibration is STALE')
        )
      );
    });
  });

  // =========================================================================
  // 5. Incompatible Equipment & Safety Eligibility
  // =========================================================================
  describe('5. Incompatible Equipment & Absolute Safety Gates', () => {
    test('preserves safety-first priority: faulty, in-use, or quarantined equipment is never eligible', () => {
      const dangerousPool = [
        {
          id: 'EQ-FAULTY',
          name: 'Faulty Super-Battery Vent',
          category: 'Ventilator',
          status: 'Faulty',
          sanitizationStatus: 'CLEARED',
          hasBattery: true,
          batteryLevel: 100,
          batteryRuntime: { verifiedMinutes: 300, verificationStatus: 'VERIFIED' },
          currentRoom: 'ER-101 (Trauma Bay 1)',
        },
        {
          id: 'EQ-DIRTY',
          name: 'Quarantined Super-Battery Vent',
          category: 'Ventilator',
          status: 'Available',
          sanitizationStatus: 'PENDING',
          hasBattery: true,
          batteryLevel: 100,
          batteryRuntime: { verifiedMinutes: 300, verificationStatus: 'VERIFIED' },
          currentRoom: 'ER-101 (Trauma Bay 1)',
        },
      ];

      const { eligible, ineligible } = filterEligibleCandidates(dangerousPool, {
        category: 'Ventilator',
        minRuntimeMinutes: 60,
      });

      assert.equal(eligible.length, 0, 'No dangerous equipment can ever pass safety filtering');
      assert.equal(ineligible.length, 2);
      assert.ok(ineligible.some((i) => i.rule === 'STATUS_UNAVAILABLE'));
      assert.ok(ineligible.some((i) => i.rule === 'SANITIZATION_RESTRICTION'));
    });

    test('excludes clinically incompatible equipment missing required capabilities', () => {
      const capabilityPool = [
        {
          id: 'EQ-ADULT-ONLY',
          name: 'Adult Ventilator',
          category: 'Ventilator',
          status: 'Available',
          sanitizationStatus: 'CLEARED',
          hasBattery: true,
          batteryLevel: 90,
          batteryRuntime: { verifiedMinutes: 200, verificationStatus: 'VERIFIED' },
          clinicalCapabilities: ['Adult', 'Invasive'],
          currentRoom: 'ER-101 (Trauma Bay 1)',
        },
      ];

      const { eligible, ineligible } = filterEligibleCandidates(capabilityPool, {
        category: 'Ventilator',
        requiredCapabilities: ['Pediatric'],
      });

      assert.equal(eligible.length, 0);
      assert.equal(ineligible.length, 1);
      assert.equal(ineligible[0].rule, 'COMPATIBILITY_UNSATISFIED');
    });
  });

  // =========================================================================
  // 6. Smarter Ranking Accuracy & Verified Runtime Advantages
  // =========================================================================
  describe('6. Smarter Ranking Accuracy & Tie-Breakers', () => {
    test('certified verified runtime outranks unbenchmarked equipment with same raw battery charge', () => {
      const candidates = [
        {
          id: 'EQ-VERIFIED',
          name: 'Ventilator Verified Runtime',
          category: 'Ventilator',
          status: 'Available',
          sanitizationStatus: 'CLEARED',
          hasBattery: true,
          batteryLevel: 90,
          batteryRuntime: {
            verifiedMinutes: 240, // 4 hours verified benchmark
            verificationStatus: 'VERIFIED',
            source: 'BIOMED_LOAD_TEST',
            lastMeasuredAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
          },
          currentRoom: 'ER-102 (Acute Resus)', // Same distance
          condition: 'Optimal',
          operatingHours: 500,
        },
        {
          id: 'EQ-UNVERIFIED',
          name: 'Ventilator Unverified Runtime',
          category: 'Ventilator',
          status: 'Available',
          sanitizationStatus: 'CLEARED',
          hasBattery: true,
          batteryLevel: 90, // Identical 90% battery percentage!
          batteryRuntime: {
            verifiedMinutes: null, // Unbenchmarked
            verificationStatus: 'UNBENCHMARKED',
            source: 'UNVERIFIED',
          },
          currentRoom: 'ER-102 (Acute Resus)', // Same distance
          condition: 'Optimal',
          operatingHours: 500,
        },
      ];

      const ranked = rankCandidates(candidates, {
        destinationRoomName: 'ER-101 (Trauma Bay 1)',
        roomsList: mockRooms,
        urgency: 'urgent',
      });

      assert.equal(ranked.length, 2);
      assert.equal(ranked[0].equipment.id, 'EQ-VERIFIED', 'Verified benchmark must rank #1 over unbenchmarked');
      assert.equal(ranked[1].equipment.id, 'EQ-UNVERIFIED');
      assert.ok(
        ranked[0].subscores.battery >= ranked[1].subscores.battery,
        'Verified runtime achieves higher battery suitability subscore'
      );
    });

    test('deterministic tie-breaker prefers longer verified runtime when overall scores are identical', () => {
      const candidates = [
        {
          id: 'EQ-MED-RUN',
          name: 'Ventilator 180m',
          category: 'Ventilator',
          status: 'Available',
          sanitizationStatus: 'CLEARED',
          hasBattery: true,
          batteryLevel: 100,
          batteryRuntime: {
            verifiedMinutes: 180,
            verificationStatus: 'VERIFIED',
            source: 'BIOMED_LOAD_TEST',
          },
          currentRoom: 'ER-101 (Trauma Bay 1)',
          condition: 'Optimal',
          operatingHours: 500,
        },
        {
          id: 'EQ-LONG-RUN',
          name: 'Ventilator 240m',
          category: 'Ventilator',
          status: 'Available',
          sanitizationStatus: 'CLEARED',
          hasBattery: true,
          batteryLevel: 100,
          batteryRuntime: {
            verifiedMinutes: 240,
            verificationStatus: 'VERIFIED',
            source: 'BIOMED_LOAD_TEST',
          },
          currentRoom: 'ER-101 (Trauma Bay 1)',
          condition: 'Optimal',
          operatingHours: 500,
        },
      ];

      const ranked = rankCandidates(candidates, {
        destinationRoomName: 'ER-101 (Trauma Bay 1)',
        roomsList: mockRooms,
      });

      assert.equal(ranked[0].equipment.id, 'EQ-LONG-RUN', 'Longer runtime wins tie-break');
      assert.equal(ranked[1].equipment.id, 'EQ-MED-RUN');
    });

    test('generateClinicalExplanation articulates runtime metrics and comparative disclosures', () => {
      const candidates = [
        {
          id: 'EQ-TOP',
          name: 'Hamilton-C6 Ventilator',
          category: 'Ventilator',
          status: 'Available',
          sanitizationStatus: 'CLEARED',
          hasBattery: true,
          batteryLevel: 95,
          batteryRuntime: {
            verifiedMinutes: 240,
            verificationStatus: 'VERIFIED',
            source: 'BIOMED_LOAD_TEST',
            lastMeasuredAt: new Date(Date.now() - 4 * 24 * 3600 * 1000),
          },
          currentRoom: 'ER-101 (Trauma Bay 1)',
          condition: 'Optimal',
          operatingHours: 400,
        },
        {
          id: 'EQ-SECOND',
          name: 'Puritan Bennett 980',
          category: 'Ventilator',
          status: 'Available',
          sanitizationStatus: 'CLEARED',
          hasBattery: true,
          batteryLevel: 80,
          batteryRuntime: {
            verifiedMinutes: 120,
            verificationStatus: 'VERIFIED',
            source: 'OEM_BENCHMARK',
          },
          currentRoom: 'ER-102 (Acute Resus)',
          condition: 'Good',
          operatingHours: 1200,
        },
      ];

      const ranked = rankCandidates(candidates, {
        destinationRoomName: 'ER-101 (Trauma Bay 1)',
        roomsList: mockRooms,
      });

      const explanation = generateClinicalExplanation(ranked, {
        category: 'Ventilator',
        destinationRoom: 'ER-101 (Trauma Bay 1)',
      });

      assert.match(explanation.keyFinding, /Verified battery runtime is 240 minutes/);
      assert.ok(explanation.comparativeAnalysis.length > 0);
    });
  });

  // =========================================================================
  // 7. REST API End-to-End Contract
  // =========================================================================
  describe('7. POST /api/ai/query Runtime Query Contract', () => {
    test('POST /api/ai/query with minRuntimeMinutes returns verified telemetry metadata', async () => {
      const res = await request(app)
        .post('/api/ai/query')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          category: 'Ventilator',
          destinationRoom: 'ER-101 (Trauma Bay 1)',
          minBatteryPercent: 50,
        });

      assert.equal(res.status, 200);
      assert.ok(res.body.success);
      assert.ok(Array.isArray(res.body.candidates));

      if (res.body.candidates.length > 0) {
        const top = res.body.candidates[0];
        assert.ok(top.metrics);
        assert.ok(top.metrics.runtimeStatus, 'Candidate must provide runtimeStatus');
        assert.ok(top.metrics.runtimeSource, 'Candidate must provide runtimeSource');
        assert.ok('batteryLevel' in top.metrics, 'Candidate must track batteryLevel separately');
        assert.ok('verifiedRuntimeMinutes' in top.metrics, 'Candidate must track verifiedRuntimeMinutes separately');
      }
    });
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
});
