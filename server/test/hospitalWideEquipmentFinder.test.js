import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { JWT_SECRET } from '../src/middleware/auth.js';
import {
  filterEligibleCandidates,
  calculateTransit,
  rankCandidates,
  generateClinicalExplanation,
  parseNaturalLanguageQuery,
} from '../src/services/recommendationEngine.js';
import {
  calculateHospitalRoute,
  resolveRoomNode,
  getHospitalGraphTopology,
} from '../src/services/indoorNavigation.js';

dotenv.config();

let doctorToken = '';
let staffToken = '';

describe('SmartMed Hospital-Wide, Location-Aware Equipment Finder Suite', () => {
  before(async () => {
    if (mongoose.connection.readyState !== 1 && process.env.MONGODB_URI) {
      try {
        await connectDB(process.env.MONGODB_URI);
      } catch (err) {
        // MongoDB Atlas offline, run tests against in-memory models/seed data
      }
    }

    let docUser = null;
    let staffUser = null;
    if (mongoose.connection.readyState === 1) {
      try {
        docUser = await User.findOne({ role: 'doctor' });
        staffUser = await User.findOne({ role: 'staff' });
      } catch (e) {}
    }

    doctorToken = jwt.sign(
      {
        id: docUser ? docUser.id : 'DOC-8491',
        email: docUser ? docUser.email : 'doctor@smartmed.hospital',
        role: 'doctor',
        name: docUser ? docUser.name : 'Dr. Maya Lin',
        department: docUser ? docUser.department : 'Intensive Care Unit',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    staffToken = jwt.sign(
      {
        id: staffUser ? staffUser.id : 'STAFF-1002',
        email: staffUser ? staffUser.email : 'staff@smartmed.hospital',
        role: 'staff',
        name: staffUser ? staffUser.name : 'Mark Davis',
        department: staffUser ? staffUser.department : 'Biomedical Engineering',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  after(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  const sampleRooms = [
    { id: 'RM-ICU-201', name: 'ICU-201 (Bed A)', floor: 'Floor 2', wing: 'North Wing', department: 'Critical Care' },
    { id: 'RM-ICU-204', name: 'ICU-204 (Negative Pressure Isolation)', floor: 'Floor 2', wing: 'North Wing', department: 'Critical Care' },
    { id: 'RM-ER-101', name: 'ER-101 (Trauma Bay 1)', floor: 'Floor 1', wing: 'East Wing', department: 'Emergency' },
    { id: 'RM-WARD-3A', name: 'Ward 3A (Room 305)', floor: 'Floor 3', wing: 'West Wing', department: 'General Ward' },
    { id: 'RM-STOR-B1', name: 'Central Clean Storage Warehouse', floor: 'Basement 1', wing: 'Service Core', department: 'Biomedical' },
  ];

  test('1. Clinician in ICU Ward A finding the nearest eligible ventilator in another room', () => {
    const parsed = parseNaturalLanguageQuery('Clinician in ICU Ward A asks for a nearby ventilator');
    assert.equal(parsed.category, 'Ventilator');
    assert.equal(parsed.clinicianRoom, 'ICU-201 (Bed A)');
    assert.equal(parsed.destinationRoom, 'ICU-201 (Bed A)');

    const equipmentPool = [
      {
        id: 'VENT-ICU-02',
        name: 'Hamilton-G5 Critical Care Ventilator',
        category: 'Ventilator',
        status: 'Available',
        condition: 'Good',
        batteryLevel: 90,
        hasBattery: true,
        verifiedRuntimeMinutes: 180,
        runtimeStatus: 'VERIFIED',
        currentRoom: 'ICU-204 (Negative Pressure Isolation)',
        sanitizationStatus: 'CLEARED',
        capabilities: ['Invasive', 'Non-Invasive'],
      },
      {
        id: 'VENT-ER-01',
        name: 'Hamilton-C1 Transport Ventilator',
        category: 'Ventilator',
        status: 'Available',
        condition: 'Excellent',
        batteryLevel: 95,
        hasBattery: true,
        verifiedRuntimeMinutes: 140,
        runtimeStatus: 'VERIFIED',
        currentRoom: 'ER-101 (Trauma Bay 1)',
        sanitizationStatus: 'CLEARED',
        capabilities: ['Invasive', 'Non-Invasive', 'Transport Ready'],
      },
    ];

    const { eligible } = filterEligibleCandidates(equipmentPool, { category: 'Ventilator' });
    assert.equal(eligible.length, 2);

    const ranked = rankCandidates(eligible, {
      destinationRoom: 'ICU-201 (Bed A)',
      clinicianRoom: 'ICU-201 (Bed A)',
      roomsList: sampleRooms,
      urgency: 'urgent',
    });

    assert.equal(ranked.length, 2);
    // Nearest eligible ventilator on same floor (ICU-204) must rank #1
    assert.equal(ranked[0].equipment.id, 'VENT-ICU-02');
    assert.equal(ranked[0].rank, 1);
    assert.equal(ranked[0].metrics.transitMeters, 24);
    assert.equal(ranked[0].metrics.floorChanges, 0);
    assert.equal(ranked[0].metrics.routeNavigable, true);
  });

  test('2. A closer but ineligible ventilator is strictly excluded before ranking', () => {
    const equipmentPool = [
      // In ICU-201 right next to clinician, but In Use
      {
        id: 'VENT-INUSE-01',
        name: 'In-Use Bedside Ventilator',
        category: 'Ventilator',
        status: 'In Use',
        condition: 'Good',
        batteryLevel: 100,
        hasBattery: true,
        verifiedRuntimeMinutes: 240,
        runtimeStatus: 'VERIFIED',
        currentRoom: 'ICU-201 (Bed A)',
        sanitizationStatus: 'CLEARED',
      },
      // In ICU-201 right next to clinician, but Quarantined / Contaminated
      {
        id: 'VENT-QUARANTINE-02',
        name: 'Contaminated Ventilator',
        category: 'Ventilator',
        status: 'Available',
        condition: 'Good',
        batteryLevel: 100,
        hasBattery: true,
        verifiedRuntimeMinutes: 200,
        runtimeStatus: 'VERIFIED',
        currentRoom: 'ICU-201 (Bed A)',
        sanitizationStatus: 'PENDING',
      },
      // In ICU-204 (24m away), fully available and sanitized
      {
        id: 'VENT-CLEAN-03',
        name: 'Sanitized ICU-204 Ventilator',
        category: 'Ventilator',
        status: 'Available',
        condition: 'Good',
        batteryLevel: 85,
        hasBattery: true,
        verifiedRuntimeMinutes: 160,
        runtimeStatus: 'VERIFIED',
        currentRoom: 'ICU-204 (Negative Pressure Isolation)',
        sanitizationStatus: 'CLEARED',
      },
    ];

    const { eligible, ineligible } = filterEligibleCandidates(equipmentPool, { category: 'Ventilator' });
    // Ineligible assets must be excluded regardless of proximity
    assert.equal(eligible.length, 1);
    assert.equal(eligible[0].id, 'VENT-CLEAN-03');
    assert.equal(ineligible.length, 2);
    assert.ok(ineligible.some((item) => item.item.id === 'VENT-INUSE-01' && item.reason.includes('clinical use')));
    assert.ok(ineligible.some((item) => item.item.id === 'VENT-QUARANTINE-02' && (item.reason.includes('sanitization') || item.reason.includes('disinfection'))));
  });

  test('3. A farther device is selected when closer devices are unsafe or unavailable', () => {
    const equipmentPool = [
      // Closer device in Floor 2 ICU, but under maintenance
      {
        id: 'VENT-MAINT-01',
        name: 'Servicing Ventilator',
        category: 'Ventilator',
        status: 'Under Maintenance',
        batteryLevel: 98,
        hasBattery: true,
        currentRoom: 'ICU-204 (Negative Pressure Isolation)',
        sanitizationStatus: 'CLEARED',
      },
      // Farther device on Floor 1 ER-101, safe and available
      {
        id: 'VENT-FAR-02',
        name: 'ER Backup Ventilator',
        category: 'Ventilator',
        status: 'Available',
        condition: 'Good',
        batteryLevel: 88,
        hasBattery: true,
        verifiedRuntimeMinutes: 120,
        runtimeStatus: 'VERIFIED',
        currentRoom: 'ER-101 (Trauma Bay 1)',
        sanitizationStatus: 'CLEARED',
      },
    ];

    const { eligible } = filterEligibleCandidates(equipmentPool, { category: 'Ventilator' });
    const ranked = rankCandidates(eligible, {
      clinicianRoom: 'ICU-201 (Bed A)',
      destinationRoom: 'ICU-201 (Bed A)',
      roomsList: sampleRooms,
    });

    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].equipment.id, 'VENT-FAR-02');
    assert.ok(ranked[0].metrics.transitMeters > 0);
    assert.equal(ranked[0].metrics.floorChanges, 1);
    assert.ok(ranked[0].metrics.routeNavigable);
  });

  test('4. Different floors and elevator routes are accurately calculated with floor changes', () => {
    const route = calculateHospitalRoute('Clean Equipment Storage B1', 'Ward 3A (Room 305)');
    assert.equal(route.isNavigable, true);
    assert.equal(route.floorChanges, 3);
    assert.ok(route.totalDistanceMeters > 0);
    assert.ok(route.estimatedTransitMinutes > 0);
    assert.ok(route.steps.some((s) => s.isElevator === true));
  });

  test('5. An unreachable equipment location is excluded from top reachable option and explained', () => {
    const equipmentPool = [
      {
        id: 'VENT-ISOLATED',
        name: 'Bunker Ventilator',
        category: 'Ventilator',
        status: 'Available',
        condition: 'Good',
        batteryLevel: 90,
        hasBattery: true,
        currentRoom: 'Unconnected Research Annex',
        sanitizationStatus: 'CLEARED',
      },
      {
        id: 'VENT-REACHABLE',
        name: 'Ward Ventilator',
        category: 'Ventilator',
        status: 'Available',
        condition: 'Good',
        batteryLevel: 75,
        hasBattery: true,
        currentRoom: 'Ward 3A (Room 305)',
        sanitizationStatus: 'CLEARED',
      },
    ];

    const { eligible } = filterEligibleCandidates(equipmentPool, { category: 'Ventilator' });
    const ranked = rankCandidates(eligible, {
      clinicianRoom: 'ICU-201 (Bed A)',
      destinationRoom: 'ICU-201 (Bed A)',
      roomsList: sampleRooms,
    });

    assert.equal(ranked.length, 2);
    // Reachable asset must rank above unreachable asset
    assert.equal(ranked[0].equipment.id, 'VENT-REACHABLE');
    assert.equal(ranked[0].metrics.routeNavigable, true);

    // Unreachable asset ranks lower, distanceScore is 0, and limitation is disclosed
    const unreachableCandidate = ranked.find((c) => c.equipment.id === 'VENT-ISOLATED');
    assert.equal(unreachableCandidate.metrics.routeNavigable, false);
    assert.equal(unreachableCandidate.subscores.distance, 0);
    assert.ok(unreachableCandidate.disclosedLimitations.some((l) => l.includes('Route unreachable')));
    assert.ok(unreachableCandidate.metrics.unreachableReason.length > 0);
  });

  test('6. Missing and stale equipment-location records are safely handled', () => {
    const staleDate = new Date(Date.now() - 15 * 86400000).toISOString(); // 15 days ago
    const equipmentPool = [
      {
        id: 'VENT-STALE',
        name: 'Stale Location Ventilator',
        category: 'Ventilator',
        status: 'Available',
        condition: 'Good',
        batteryLevel: 80,
        hasBattery: true,
        currentRoom: 'ICU-204 (Negative Pressure Isolation)',
        locationConfirmedAt: staleDate,
        sanitizationStatus: 'CLEARED',
      },
      {
        id: 'VENT-NOLOC',
        name: 'Missing Location Ventilator',
        category: 'Ventilator',
        status: 'Available',
        condition: 'Good',
        batteryLevel: 80,
        hasBattery: true,
        currentRoom: null, // missing location
        sanitizationStatus: 'CLEARED',
      },
    ];

    const { eligible } = filterEligibleCandidates(equipmentPool, { category: 'Ventilator' });
    const ranked = rankCandidates(eligible, {
      clinicianRoom: 'ICU-201 (Bed A)',
      destinationRoom: 'ICU-201 (Bed A)',
      roomsList: sampleRooms,
    });

    // Stale candidate gets STALE locationFreshness
    const staleCand = ranked.find((c) => c.equipment.id === 'VENT-STALE');
    assert.equal(staleCand.metrics.locationFreshness, 'STALE');
    assert.ok(staleCand.disclosedLimitations.some((l) => l.includes('Physical location was confirmed')));

    // Missing location candidate is safely handled as unnavigable without crashing
    const noLocCand = ranked.find((c) => c.equipment.id === 'VENT-NOLOC');
    assert.equal(noLocCand.metrics.routeNavigable, false);
    assert.equal(noLocCand.metrics.locationFreshness, 'MISSING');
    assert.ok(noLocCand.disclosedLimitations.some((l) => l.includes('missing')));
  });

  test('7. Manual room selection and QR-confirmed location tracking', async () => {
    const resQR = await request(app)
      .post('/api/ai/recommend')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        clinicianRoom: 'ICU-201 (Bed A)',
        locationSource: 'QR_SCAN',
        locationConfidence: 'HIGH',
        category: 'Ventilator',
      });

    assert.equal(resQR.status, 200);
    assert.equal(resQR.body.success, true);
    assert.equal(resQR.body.clinicianLocation.source, 'QR_SCAN');
    assert.equal(resQR.body.clinicianLocation.confidence, 'HIGH');
    assert.ok(resQR.body.clinicianLocation.positioningBoundary.disclosure.includes('indoor positioning'));

    const resManual = await request(app)
      .post('/api/ai/recommend')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        clinicianRoom: 'ER-101 (Trauma Bay 1)',
        locationSource: 'MANUAL_SELECTION',
        locationConfidence: 'MANUAL_UNVERIFIED',
        category: 'Ventilator',
      });

    assert.equal(resManual.status, 200);
    assert.equal(resManual.body.success, true);
    assert.equal(resManual.body.clinicianLocation.source, 'MANUAL_SELECTION');
    assert.equal(resManual.body.clinicianLocation.confidence, 'MANUAL_UNVERIFIED');
  });

  test('8. Changes to equipment status, location, and runtime change results dynamically', () => {
    const baseEquipment = {
      id: 'DYN-VENT-01',
      name: 'Dynamic Test Ventilator',
      category: 'Ventilator',
      status: 'Available',
      condition: 'Good',
      batteryLevel: 90,
      hasBattery: true,
      verifiedRuntimeMinutes: 180,
      runtimeStatus: 'VERIFIED',
      currentRoom: 'ICU-204 (Negative Pressure Isolation)',
      sanitizationStatus: 'CLEARED',
    };

    const { eligible: eligibleA } = filterEligibleCandidates([baseEquipment], { category: 'Ventilator' });
    const rankedA = rankCandidates(eligibleA, {
      clinicianRoom: 'ICU-201 (Bed A)',
      destinationRoom: 'ICU-201 (Bed A)',
      roomsList: sampleRooms,
    });
    assert.equal(rankedA.length, 1);
    const scoreA = rankedA[0].overallScore;

    const modifiedEquipmentB = {
      ...baseEquipment,
      verifiedRuntimeMinutes: 30,
      batteryLevel: 25,
    };
    const { eligible: eligibleB } = filterEligibleCandidates([modifiedEquipmentB], { category: 'Ventilator' });
    const rankedB = rankCandidates(eligibleB, {
      clinicianRoom: 'ICU-201 (Bed A)',
      destinationRoom: 'ICU-201 (Bed A)',
      roomsList: sampleRooms,
    });
    assert.ok(rankedB[0].overallScore < scoreA, 'Lower battery and runtime must yield a lower suitability score');

    const modifiedEquipmentC = {
      ...baseEquipment,
      status: 'In Use',
    };
    const { eligible: eligibleC } = filterEligibleCandidates([modifiedEquipmentC], { category: 'Ventilator' });
    assert.equal(eligibleC.length, 0);
  });

  test('9. Backend authorization and reservation revalidation on /api/ai/allocate', async () => {
    // 9a. Non-clinical staff role is rejected with 403
    const staffRes = await request(app)
      .post('/api/ai/allocate')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        equipmentId: 'EQ-VENT-01',
        clinicianRoom: 'ICU-201 (Bed A)',
      });
    assert.equal(staffRes.status, 403);

    // 9b. Missing parameters rejected
    const badParamRes = await request(app)
      .post('/api/ai/allocate')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({});
    assert.equal(badParamRes.status, 400);

    // 9c. Unauthenticated call rejected
    const unauthRes = await request(app)
      .post('/api/ai/allocate')
      .send({ equipmentId: 'EQ-VENT-01' });
    assert.equal(unauthRes.status, 401);
  });
});
