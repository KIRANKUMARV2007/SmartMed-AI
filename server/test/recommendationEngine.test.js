import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { JWT_SECRET } from '../src/middleware/auth.js';
import {
  filterEligibleCandidates,
  calculateTransit,
  rankCandidates,
  generateClinicalExplanation,
  parseNaturalLanguageQuery,
} from '../src/services/recommendationEngine.js';

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

const staffToken = jwt.sign(
  {
    id: 'USR-STAFF-01',
    email: 'staff@smartmed.hospital',
    role: 'staff',
    name: 'Mark Davis',
    department: 'Biomedical Engineering',
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

describe('SmartMed AI Recommendation Engine - Unit & Contract Tests', () => {
  const sampleRooms = [
    { id: 'RM-ER-101', name: 'ER-101 (Trauma Bay 1)', floor: 'Floor 1', wing: 'East Wing', department: 'Emergency' },
    { id: 'RM-ER-102', name: 'ER-102 (Acute Resus)', floor: 'Floor 1', wing: 'East Wing', department: 'Emergency' },
    { id: 'RM-ICU-201', name: 'ICU-201 (Bed A)', floor: 'Floor 2', wing: 'North Wing', department: 'ICU' },
    { id: 'RM-ICU-204', name: 'ICU-204 (Negative Pressure Isolation)', floor: 'Floor 2', wing: 'North Wing', department: 'ICU' },
    { id: 'RM-BIOMED-B1', name: 'Biomedical Workshop B1', floor: 'Basement 1', wing: 'Service Core', department: 'Biomed' },
  ];

  test('1. Strict safety filtering excludes unavailable, faulty, and quarantined assets', () => {
    const equipmentPool = [
      // Candidate A: Available, sanitized, optimal
      {
        id: 'EQ-V1',
        name: 'Ventilator Alpha',
        category: 'Ventilator',
        status: 'Available',
        sanitizationStatus: 'CLEARED',
        batteryLevel: 95,
        hasBattery: true,
        currentRoom: 'ICU-204 (Negative Pressure Isolation)',
      },
      // Candidate B: High battery & same room, BUT in active clinical use -> MUST BE EXCLUDED!
      {
        id: 'EQ-V2',
        name: 'Ventilator Beta',
        category: 'Ventilator',
        status: 'In Use',
        sanitizationStatus: 'CLEARED',
        batteryLevel: 100,
        hasBattery: true,
        currentRoom: 'ER-101 (Trauma Bay 1)',
      },
      // Candidate C: Available, BUT quarantine pending -> MUST BE EXCLUDED!
      {
        id: 'EQ-V3',
        name: 'Ventilator Gamma',
        category: 'Ventilator',
        status: 'Sanitization Required',
        sanitizationStatus: 'PENDING',
        batteryLevel: 90,
        hasBattery: true,
        currentRoom: 'Central Sanitization & Decon Bay',
      },
      // Candidate D: Under maintenance -> MUST BE EXCLUDED!
      {
        id: 'EQ-V4',
        name: 'Ventilator Delta',
        category: 'Ventilator',
        status: 'Under Maintenance',
        sanitizationStatus: 'CLEARED',
        batteryLevel: 80,
        hasBattery: true,
        currentRoom: 'Biomedical Workshop B1',
      },
    ];

    const { eligible, ineligible } = filterEligibleCandidates(equipmentPool, {
      category: 'Ventilator',
    });

    assert.equal(eligible.length, 1);
    assert.equal(eligible[0].id, 'EQ-V1');
    assert.equal(ineligible.length, 3);

    // Verify reasons are clear and audit-ready
    const inUseItem = ineligible.find((i) => i.item.id === 'EQ-V2');
    assert.match(inUseItem.reason, /Currently in clinical use/);

    const deconItem = ineligible.find((i) => i.item.id === 'EQ-V3');
    assert.match(deconItem.reason, /Quarantined|Awaiting terminal disinfection/);
  });

  test('2. Safety restriction CANNOT be overridden by short distance or 100% battery', () => {
    const equipmentPool = [
      {
        id: 'EQ-RISK-01',
        name: 'Bedside Faulty Ventilator',
        category: 'Ventilator',
        status: 'Faulty',
        sanitizationStatus: 'CLEARED',
        batteryLevel: 100,
        currentRoom: 'ER-101 (Trauma Bay 1)', // Same room!
      },
    ];

    const { eligible, ineligible } = filterEligibleCandidates(equipmentPool, {
      category: 'Ventilator',
    });

    assert.equal(eligible.length, 0, 'Faulty equipment must never qualify regardless of proximity or battery');
    assert.equal(ineligible.length, 1);
    assert.equal(ineligible[0].rule, 'STATUS_UNAVAILABLE');
  });

  test('3. Floor-plan transit calculation produces realistic multi-floor estimates', () => {
    // Immediate bedside (same room)
    const t0 = calculateTransit('ER-101 (Trauma Bay 1)', 'ER-101 (Trauma Bay 1)', sampleRooms);
    assert.equal(t0.minutes, 0);
    assert.equal(t0.isEstimate, false);

    // Same floor, same wing
    const t1 = calculateTransit('ER-101 (Trauma Bay 1)', 'ER-102 (Acute Resus)', sampleRooms);
    assert.equal(t1.minutes, 1.0);
    assert.equal(t1.isEstimate, true);

    // Multi-floor (Floor 2 to Floor 1: 1 floor diff = 3.5 mins)
    const t2 = calculateTransit('ICU-204 (Negative Pressure Isolation)', 'ER-101 (Trauma Bay 1)', sampleRooms);
    assert.equal(t2.minutes, 3.5);
    assert.equal(t2.isEstimate, true);

    // Unmodeled room gracefully flags limitation
    const tUnmapped = calculateTransit('Unknown Room X', 'ER-101 (Trauma Bay 1)', sampleRooms);
    assert.equal(tUnmapped.minutes, null);
    assert.equal(tUnmapped.tier, 'unknown');
  });

  test('4. Transparent ranking favors closer distance and verified battery runtime', () => {
    const candidates = [
      {
        id: 'EQ-FAR',
        name: 'Ventilator Far',
        category: 'Ventilator',
        status: 'Available',
        sanitizationStatus: 'CLEARED',
        batteryLevel: 95,
        hasBattery: true,
        verifiedRuntimeMinutes: 240,
        currentRoom: 'ICU-204 (Negative Pressure Isolation)', // Floor 2 (Elevator transit)
        condition: 'Optimal',
        operatingHours: 900,
      },
      {
        id: 'EQ-NEAR',
        name: 'Ventilator Near',
        category: 'Ventilator',
        status: 'Available',
        sanitizationStatus: 'CLEARED',
        batteryLevel: 92,
        hasBattery: true,
        verifiedRuntimeMinutes: 240,
        currentRoom: 'ER-102 (Acute Resus)', // Same Floor!
        condition: 'Optimal',
        operatingHours: 900,
      },
    ];

    const ranked = rankCandidates(candidates, {
      destinationRoomName: 'ER-101 (Trauma Bay 1)',
      roomsList: sampleRooms,
      urgency: 'urgent',
    });

    assert.equal(ranked.length, 2);
    // EQ-NEAR should outrank EQ-FAR for urgent emergency due to shorter transit
    assert.equal(ranked[0].equipment.id, 'EQ-NEAR');
    assert.equal(ranked[0].rank, 1);
    assert.ok(ranked[0].overallScore > ranked[1].overallScore);
  });

  test('5. Disclosed limitations explicitly identify unbenchmarked battery runtime', () => {
    const uncalibratedCandidate = [
      {
        id: 'EQ-UNCAL',
        name: 'Ventilator Uncalibrated',
        category: 'Ventilator',
        status: 'Available',
        sanitizationStatus: 'CLEARED',
        batteryLevel: 90,
        hasBattery: true,
        verifiedRuntimeMinutes: null, // Unbenchmarked!
        currentRoom: 'ER-101 (Trauma Bay 1)',
        condition: 'Optimal',
      },
    ];

    const ranked = rankCandidates(uncalibratedCandidate, {
      destinationRoomName: 'ER-101 (Trauma Bay 1)',
      roomsList: sampleRooms,
      urgency: 'urgent',
    });

    const limitations = ranked[0].disclosedLimitations;
    assert.ok(limitations.some((l) => l.includes('Verified battery runtime duration is not logged')));
  });

  test('6. Empty candidate state reports clear explanation without fabricating candidates', () => {
    const explanation = generateClinicalExplanation([], {
      category: 'Ventilator',
      destinationRoom: 'ER-101 (Trauma Bay 1)',
    });

    assert.match(explanation.summary, /No available Ventilator met clinical safety/);
    assert.equal(explanation.candidateRationales.length, 0);
  });

  test('7. Natural language parser extracts clinical intent accurately', () => {
    const prompt = 'Find the best available ventilator for an emergency in ER-101 based on battery charge and distance';
    const parsed = parseNaturalLanguageQuery(prompt, sampleRooms);

    assert.equal(parsed.category, 'Ventilator');
    assert.equal(parsed.destinationRoom, 'ER-101 (Trauma Bay 1)');
    assert.equal(parsed.urgency, 'urgent');
  });

  test('8. POST /api/ai/query rejects unauthenticated request with 401', async () => {
    const res = await request(app).post('/api/ai/query').send({
      category: 'Ventilator',
    });
    assert.equal(res.status, 401);
  });

  test('9. POST /api/ai/allocate rejects non-clinical staff with 403', async () => {
    const res = await request(app)
      .post('/api/ai/allocate')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        equipmentId: 'EQ-VENT-02',
      });
    assert.equal(res.status, 403);
  });

  test('10. POST /api/ai/allocate requires equipmentId with 400', async () => {
    const res = await request(app)
      .post('/api/ai/allocate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    assert.equal(res.status, 400);
    assert.match(res.body.error, /equipmentId is required/);
  });
});
