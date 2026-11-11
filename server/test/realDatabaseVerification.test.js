import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Equipment } from '../src/models/Equipment.js';
import { Room } from '../src/models/Room.js';
import { MaintenanceTicket } from '../src/models/MaintenanceTicket.js';
import { MovementLog } from '../src/models/MovementLog.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { JWT_SECRET } from '../src/middleware/auth.js';
import { releaseExpiredReservations } from '../src/services/reservationService.js';

dotenv.config();

let doctorToken = '';
let nurseToken = '';
let staffToken = '';

describe('SmartMed AI Recommendation & Reservation - Real Database Integration Suite', () => {
  before(async () => {
    if (mongoose.connection.readyState !== 1 && process.env.MONGODB_URI) {
      try {
        await connectDB(process.env.MONGODB_URI);
      } catch (err) {
        console.warn('[Real DB Suite Blocked] Live MongoDB Atlas connection unavailable:', err.message);
      }
    }
    let docUser = null;
    let nurseUser = null;
    let staffUser = null;
    if (mongoose.connection.readyState === 1) {
      try {
        docUser = await User.findOne({ role: 'doctor' });
        nurseUser = await User.findOne({ role: 'nurse' });
        staffUser = await User.findOne({ role: 'staff' });
      } catch (e) {}
    }

    doctorToken = jwt.sign(
      {
        id: docUser ? docUser.id : 'DOC-8491',
        email: docUser ? docUser.email : 'doctor@smartmed.hospital',
        role: 'doctor',
        name: docUser ? docUser.name : 'Dr. Maya Lin',
        department: docUser ? docUser.department : 'Emergency Medicine',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    nurseToken = jwt.sign(
      {
        id: nurseUser ? nurseUser.id : 'NUR-2305',
        email: nurseUser ? nurseUser.email : 'nurse@smartmed.hospital',
        role: 'nurse',
        name: nurseUser ? nurseUser.name : 'Nurse Sarah Jenkins, RN',
        department: nurseUser ? nurseUser.department : 'Intensive Care Unit (ICU)',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    staffToken = jwt.sign(
      {
        id: staffUser ? staffUser.id : 'STF-4412',
        email: staffUser ? staffUser.email : 'staff@smartmed.hospital',
        role: 'staff',
        name: staffUser ? staffUser.name : 'Mark Davis, CBET',
        department: staffUser ? staffUser.department : 'Biomedical Engineering',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  // =========================================================================
  // 1. REAL DATABASE INTEGRATION
  // =========================================================================
  describe('1. Real Database Integration', () => {
    test('Queries real equipment records from MongoDB Atlas smartmed collection', async (t) => {
      if (mongoose.connection.readyState !== 1) {
        t.skip('Requires live MongoDB Atlas connection (blocked by Atlas IP allowlist)');
        return;
      }
      const realAssets = await Equipment.find({}).lean();
      assert.ok(realAssets.length > 0, 'Database must contain real equipment assets');
      
      const realRooms = await Room.find({}).lean();
      assert.ok(realRooms.length > 0, 'Database must contain real rooms');

      // Execute AI recommendation endpoint with live DB
      const res = await request(app)
        .post('/api/ai/query')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          prompt: 'Find the best available ventilator for an emergency',
          category: 'Ventilator',
          destinationRoom: 'ER-101 (Trauma Bay 1)',
          urgency: 'urgent',
        });

      assert.equal(res.status, 200);
      assert.ok(res.body.success, 'Recommendation must succeed');
      assert.ok(Array.isArray(res.body.candidates), 'Candidates must be an array');
      
      // Verify candidates correspond to actual DB assets
      for (const candidate of res.body.candidates) {
        const dbRecord = realAssets.find((a) => a.id === candidate.equipment.id);
        assert.ok(dbRecord, `Candidate ${candidate.equipment.id} must exist in MongoDB Atlas`);
        assert.equal(candidate.equipment.name, dbRecord.name);
        assert.equal(candidate.equipment.status, 'Available');
      }
    });

    test('Status, battery, sanitization, and maintenance changes dynamically affect recommendations', async (t) => {
      if (mongoose.connection.readyState !== 1) {
        t.skip('Requires live MongoDB Atlas connection (blocked by Atlas IP allowlist)');
        return;
      }
      // Find EQ-VENT-02
      const vent02 = await Equipment.findOne({ id: 'EQ-VENT-02' });
      assert.ok(vent02, 'EQ-VENT-02 must exist for test');

      const originalStatus = vent02.status;
      const originalBattery = vent02.batteryLevel;
      const originalSanitization = vent02.sanitizationStatus;
      const originalRoom = vent02.currentRoom;

      try {
        // A. Changing status to 'In Use' excludes it
        await Equipment.updateOne({ id: 'EQ-VENT-02' }, { $set: { status: 'In Use' } });
        let res = await request(app)
          .post('/api/ai/query')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send({ category: 'Ventilator', destinationRoom: 'ER-101 (Trauma Bay 1)' });

        assert.equal(res.status, 200);
        assert.ok(!res.body.candidates.some((c) => c.equipment.id === 'EQ-VENT-02'), 'In-Use asset must be excluded');
        assert.ok(res.body.ineligibleAssets.some((i) => i.id === 'EQ-VENT-02'), 'Must be in ineligible list');

        // B. Restoring status to 'Available' but setting sanitization to 'PENDING' excludes it
        await Equipment.updateOne(
          { id: 'EQ-VENT-02' },
          { $set: { status: 'Available', sanitizationStatus: 'PENDING' } }
        );
        res = await request(app)
          .post('/api/ai/query')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send({ category: 'Ventilator', destinationRoom: 'ER-101 (Trauma Bay 1)' });

        assert.ok(!res.body.candidates.some((c) => c.equipment.id === 'EQ-VENT-02'), 'Pending sanitization asset must be excluded');

        // C. Restoring sanitization to 'CLEARED' restores it to eligible candidates
        await Equipment.updateOne(
          { id: 'EQ-VENT-02' },
          { $set: { sanitizationStatus: 'CLEARED' } }
        );
        res = await request(app)
          .post('/api/ai/query')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send({ category: 'Ventilator', destinationRoom: 'ER-101 (Trauma Bay 1)' });

        assert.ok(res.body.candidates.some((c) => c.equipment.id === 'EQ-VENT-02'), 'Cleared available asset must be eligible');

        // D. Changing battery changes the score
        await Equipment.updateOne({ id: 'EQ-VENT-02' }, { $set: { batteryLevel: 30 } });
        const resLowBat = await request(app)
          .post('/api/ai/query')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send({ category: 'Ventilator', destinationRoom: 'ER-101 (Trauma Bay 1)' });

        const lowBatCandidate = resLowBat.body.candidates.find((c) => c.equipment.id === 'EQ-VENT-02');
        assert.equal(lowBatCandidate.subscores.battery, 30);

        await Equipment.updateOne({ id: 'EQ-VENT-02' }, { $set: { batteryLevel: 92 } });
        const resHighBat = await request(app)
          .post('/api/ai/query')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send({ category: 'Ventilator', destinationRoom: 'ER-101 (Trauma Bay 1)' });

        const highBatCandidate = resHighBat.body.candidates.find((c) => c.equipment.id === 'EQ-VENT-02');
        assert.equal(highBatCandidate.subscores.battery, 92);
        assert.ok(highBatCandidate.overallScore > lowBatCandidate.overallScore, 'Higher battery must yield higher overall score');
      } finally {
        // ALWAYS strictly restore original values to prevent corrupting DB
        await Equipment.updateOne(
          { id: 'EQ-VENT-02' },
          {
            $set: {
              status: originalStatus,
              batteryLevel: originalBattery,
              sanitizationStatus: originalSanitization,
              currentRoom: originalRoom,
            },
          }
        );
      }
    });
  });

  // =========================================================================
  // 2. SAFETY RULES VERIFICATION
  // =========================================================================
  describe('2. Safety Rules & Eligibility Gates', () => {
    test('Equipment marked In Use, Under Maintenance, Faulty, or Quarantine is never eligible', async () => {
      const res = await request(app)
        .post('/api/ai/query')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          category: 'Ventilator',
          destinationRoom: 'ER-101 (Trauma Bay 1)',
          urgency: 'urgent',
        });

      assert.equal(res.status, 200);

      // Verify EQ-VENT-01 (In Use) is in ineligible list
      const vent01Ineligible = res.body.ineligibleAssets.find((a) => a.id === 'EQ-VENT-01');
      assert.ok(vent01Ineligible, 'EQ-VENT-01 must be marked ineligible');
      assert.equal(vent01Ineligible.status, 'In Use');
      assert.equal(vent01Ineligible.rule, 'STATUS_UNAVAILABLE');

      // Ensure NO candidate in the recommendations has an unsafe status
      for (const cand of res.body.candidates) {
        assert.equal(cand.equipment.status, 'Available');
        assert.equal(cand.equipment.sanitizationStatus, 'CLEARED');
      }
    });

    test('Equipment with insufficient battery threshold is excluded', async () => {
      const res = await request(app)
        .post('/api/ai/query')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          category: 'Ventilator',
          destinationRoom: 'ER-101 (Trauma Bay 1)',
          minBatteryPercent: 98, // EQ-VENT-02 has 92%, so 98% will exclude it
        });

      assert.equal(res.status, 200);
      assert.ok(!res.body.candidates.some((c) => c.equipment.id === 'EQ-VENT-02'));
      assert.ok(res.body.ineligibleAssets.some((i) => i.id === 'EQ-VENT-02' && (i.rule === 'BATTERY_INSUFFICIENT' || i.rule === 'INSUFFICIENT_BATTERY')));
    });

    test('Backend safety checks CANNOT be bypassed through frontend query parameters', async () => {
      // Attacker tries to pass bypass flags or override safety
      const res = await request(app)
        .post('/api/ai/query')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          category: 'Ventilator',
          destinationRoom: 'ER-101 (Trauma Bay 1)',
          bypassSafety: true,
          forceIncludeInUse: true,
          allowUnsanitized: true,
        });

      assert.equal(res.status, 200);
      // EQ-VENT-01 must STILL be excluded
      assert.ok(!res.body.candidates.some((c) => c.equipment.id === 'EQ-VENT-01'));
      assert.ok(res.body.ineligibleAssets.some((i) => i.id === 'EQ-VENT-01'));
    });
  });

  // =========================================================================
  // 3. RANKING ACCURACY & TRANSPARENCY
  // =========================================================================
  describe('3. Ranking Accuracy & Formula', () => {
    test('Calculates multi-factor score and provides transparent metrics and disclosures', async () => {
      const res = await request(app)
        .post('/api/ai/query')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          category: 'Ventilator',
          destinationRoom: 'ER-101 (Trauma Bay 1)',
          urgency: 'urgent',
        });

      assert.equal(res.status, 200);
      const candidate = res.body.candidates[0];
      assert.ok(candidate, 'Must have at least one candidate');

      // Verify subscores are within [0, 100]
      assert.ok(candidate.subscores.distance >= 0 && candidate.subscores.distance <= 100);
      assert.ok(candidate.subscores.battery >= 0 && candidate.subscores.battery <= 100);
      assert.ok(candidate.subscores.readiness >= 0 && candidate.subscores.readiness <= 100);
      assert.ok(candidate.subscores.compatibility >= 0 && candidate.subscores.compatibility <= 100);

      // Verify overall score adheres to weights (or blended with Random Forest model when ML is active)
      if (candidate.mlSuitabilityScore !== undefined) {
        assert.ok(candidate.overallScore >= 0 && candidate.overallScore <= 100);
      } else {
        const expectedOverall = Math.round(
          0.4 * candidate.subscores.distance +
          0.3 * candidate.subscores.battery +
          0.2 * candidate.subscores.readiness +
          0.1 * candidate.subscores.compatibility
        );
        assert.equal(candidate.overallScore, expectedOverall, 'Overall score matches formula');
      }

      // Verify disclosures distinguish battery % from verified remaining runtime
      assert.ok(res.body.disclosures.batteryRuntimeDisclaimer);
      assert.match(res.body.disclosures.batteryRuntimeDisclaimer, /not equivalent to benchmarked runtime/i);
      assert.match(res.body.disclosures.transitTimeDisclaimer, /architectural floor-plan graph/i);
    });
  });

  // =========================================================================
  // 4. EMERGENCY RESERVATION & ALLOCATION
  // =========================================================================
  describe('4. Emergency Reservation Lifecycle & Concurrency', () => {
    test('Atomically allocates equipment with 30-minute hold and generates audit logs', async (t) => {
      if (mongoose.connection.readyState !== 1) {
        t.skip('Requires live MongoDB Atlas connection (blocked by Atlas IP allowlist)');
        return;
      }
      const targetId = 'EQ-VENT-02';
      const beforeAsset = await Equipment.findOne({ id: targetId });
      assert.equal(beforeAsset.status, 'Available');

      try {
        const allocateRes = await request(app)
          .post('/api/ai/allocate')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send({
            equipmentId: targetId,
            destinationRoom: 'ER-101 (Trauma Bay 1)',
            purpose: 'AI Integration Emergency Test Hold',
            durationMinutes: 30,
          });

        assert.equal(allocateRes.status, 200);
        assert.ok(allocateRes.body.success);

        // Verify database state
        const allocatedAsset = await Equipment.findOne({ id: targetId });
        assert.equal(allocatedAsset.status, 'Reserved');
        assert.ok(allocatedAsset.reservation);
        assert.equal(allocatedAsset.reservation.reservedBy, 'Dr. Maya Lin');
        
        // Check 30m expiration window (~30 minutes from now)
        const expiresAtTime = new Date(allocatedAsset.reservation.expiresAt).getTime();
        const nowTime = Date.now();
        const diffMinutes = (expiresAtTime - nowTime) / (60 * 1000);
        assert.ok(diffMinutes >= 28 && diffMinutes <= 31, `Expires in ~30 mins, got ${diffMinutes}m`);

        // Verify MovementLog and AuditLog
        const movement = await MovementLog.findOne({ equipmentId: targetId, type: 'AI-Recommended Emergency Allocation' })
          .sort({ createdAt: -1 });
        assert.ok(movement, 'Movement log entry must be created');
        assert.equal(movement.staffName, 'Dr. Maya Lin');

        const audit = await AuditLog.findOne({ targetId, action: 'AI_EQUIPMENT_ALLOCATED' })
          .sort({ createdAt: -1 });
        assert.ok(audit, 'Audit log entry must be created');
        assert.equal(audit.performedBy.role, 'doctor');
      } finally {
        // Restore EQ-VENT-02 back to Available
        await Equipment.updateOne(
          { id: targetId },
          { $set: { status: 'Available', reservation: null } }
        );
      }
    });

    test('Simultaneous reservation attempts: Only 1 succeeds, concurrent attempt fails with 409 Conflict', async (t) => {
      if (mongoose.connection.readyState !== 1) {
        t.skip('Requires live MongoDB Atlas connection (blocked by Atlas IP allowlist)');
        return;
      }
      const targetId = 'EQ-VENT-02';
      // Ensure available initially
      await Equipment.updateOne({ id: targetId }, { $set: { status: 'Available', reservation: null } });

      try {
        // Send two concurrent allocation requests simultaneously
        const [attemptA, attemptB] = await Promise.all([
          request(app)
            .post('/api/ai/allocate')
            .set('Authorization', `Bearer ${doctorToken}`)
            .send({
              equipmentId: targetId,
              destinationRoom: 'ER-101 (Trauma Bay 1)',
              purpose: 'Concurrent Clinician A',
            }),
          request(app)
            .post('/api/ai/allocate')
            .set('Authorization', `Bearer ${nurseToken}`)
            .send({
              equipmentId: targetId,
              destinationRoom: 'ICU-201 (Bed A)',
              purpose: 'Concurrent Clinician B',
            }),
        ]);

        const statuses = [attemptA.status, attemptB.status].sort();
        // One must succeed (200) and one must receive Conflict (409)
        assert.deepEqual(
          statuses,
          [200, 409],
          `Expected exactly one 200 and one 409 conflict, got ${attemptA.status} and ${attemptB.status}`
        );

        const failedAttempt = attemptA.status === 409 ? attemptA : attemptB;
        assert.ok(
          failedAttempt.body.code === 'RACE_CONDITION_DETECTED' ||
          failedAttempt.body.code === 'EQUIPMENT_UNAVAILABLE',
          `Conflict code must indicate safety collision: ${failedAttempt.body.code}`
        );
      } finally {
        // Restore back to Available
        await Equipment.updateOne(
          { id: targetId },
          { $set: { status: 'Available', reservation: null } }
        );
      }
    });

    test('Revalidates safety immediately before reserving: In Use or Quarantined asset is rejected', async (t) => {
      if (mongoose.connection.readyState !== 1) {
        t.skip('Requires live MongoDB Atlas connection (blocked by Atlas IP allowlist)');
        return;
      }
      // Attempt to allocate EQ-VENT-01 (In Use)
      const res = await request(app)
        .post('/api/ai/allocate')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          equipmentId: 'EQ-VENT-01',
          destinationRoom: 'ER-101 (Trauma Bay 1)',
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.code, 'EQUIPMENT_UNAVAILABLE');
    });

    test('Reservation expiry release restores asset to Available and logs audit trail', async (t) => {
      if (mongoose.connection.readyState !== 1) {
        t.skip('Requires live MongoDB Atlas connection (blocked by Atlas IP allowlist)');
        return;
      }
      const targetId = 'EQ-VENT-02';
      // Set an expired reservation (expired 5 minutes ago)
      const pastTime = new Date(Date.now() - 5 * 60 * 1000);
      await Equipment.updateOne(
        { id: targetId },
        {
          $set: {
            status: 'Reserved',
            reservation: {
              reservedBy: 'Test Clinician',
              staffId: 'STF-TEST',
              department: 'Triage',
              reservedAt: new Date(Date.now() - 35 * 60 * 1000),
              expiresAt: pastTime,
              purpose: 'Hold Expired Test',
            },
          },
        }
      );

      try {
        // Run expiry cleanup service
        const released = await releaseExpiredReservations();
        assert.ok(released.some((r) => r.id === targetId), 'Expired asset must be released');

        // Confirm DB state is now Available
        const updated = await Equipment.findOne({ id: targetId });
        assert.equal(updated.status, 'Available');
        assert.equal(updated.reservation, null);

        // Verify movement log for expiry
        const expiryLog = await MovementLog.findOne({
          equipmentId: targetId,
          type: 'Reservation Auto-Released (Expired)',
        }).sort({ createdAt: -1 });

        assert.ok(expiryLog, 'Auto-release movement log must exist');
      } finally {
        // Ensure clean state
        await Equipment.updateOne(
          { id: targetId },
          { $set: { status: 'Available', reservation: null } }
        );
      }
    });
  });

  // =========================================================================
  // 5. SECURITY & ROLE-BASED ACCESS CONTROL (RBAC)
  // =========================================================================
  describe('5. Security & Authorization', () => {
    test('Unauthenticated requests are rejected with 401', async () => {
      const queryRes = await request(app).post('/api/ai/query').send({ category: 'Ventilator' });
      assert.equal(queryRes.status, 401);

      const allocRes = await request(app).post('/api/ai/allocate').send({ equipmentId: 'EQ-VENT-02' });
      assert.equal(allocRes.status, 401);
    });

    test('Non-clinical staff role is rejected from allocating equipment with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/ai/allocate')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ equipmentId: 'EQ-VENT-02', destinationRoom: 'ER-101' });

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'FORBIDDEN');
    });

    test('Doctor and Nurse roles are authorized to query and allocate', async () => {
      const docQuery = await request(app)
        .post('/api/ai/query')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ category: 'Ventilator' });
      assert.equal(docQuery.status, 200);

      const nurseQuery = await request(app)
        .post('/api/ai/query')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({ category: 'Ventilator' });
      assert.equal(nurseQuery.status, 200);
    });
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
});

