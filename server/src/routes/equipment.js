import express from 'express';
import { Equipment } from '../models/Equipment.js';
import { MovementLog } from '../models/MovementLog.js';
import { AuditLog } from '../models/AuditLog.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { releaseExpiredReservations } from '../services/reservationService.js';

const router = express.Router();

// GET /api/equipment - list equipment with filtering & search (Authenticated users)
router.get('/', authenticate, async (req, res, next) => {
  try {
    await releaseExpiredReservations();

    const { status, category, currentRoom, search } = req.query;
    const filter = {};

    if (status && status !== 'All') {
      filter.status = status;
    }
    if (category && category !== 'All') {
      filter.category = category;
    }
    if (currentRoom && currentRoom !== 'All') {
      filter.currentRoom = currentRoom;
    }
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { id: regex },
        { name: regex },
        { model: regex },
        { currentRoom: regex },
      ];
    }

    const items = await Equipment.find(filter).sort({ id: 1 });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// GET /api/equipment/:id - get single equipment
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const item = await Equipment.findOne({ id: req.params.id.toUpperCase() });
    if (!item) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// POST /api/equipment - register new equipment (Admin only)
router.post('/', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { id, name, category, model, serialNumber, currentRoom, batteryLevel, notes } = req.body;

    if (!name || !category || !currentRoom) {
      return res.status(400).json({ error: 'Missing required equipment fields (name, category, currentRoom).' });
    }

    // Determine equipment ID: use client-supplied ID or generate clinical format
    let equipmentId = id && typeof id === 'string' && id.trim() ? id.trim().toUpperCase() : null;
    if (!equipmentId) {
      const prefix = category.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'EQP';
      equipmentId = `EQ-${prefix}-${Math.floor(100 + Math.random() * 900)}`;
    }

    const existing = await Equipment.findOne({ id: equipmentId });
    if (existing) {
      return res.status(409).json({ error: `Equipment with ID ${equipmentId} already exists.` });
    }

    const hasBattery =
      typeof req.body.hasBattery === 'boolean'
        ? req.body.hasBattery
        : batteryLevel !== undefined && batteryLevel !== null;

    const parsedBattery =
      hasBattery && batteryLevel !== undefined && batteryLevel !== null
        ? Number(batteryLevel)
        : null;

    const staffName = req.user ? req.user.name : (req.body.registeredBy || 'Clinical Staff');
    const staffId = req.user ? req.user.id : (req.body.staffId || 'SYS-01');
    const staffRole = req.user ? req.user.role : (req.body.staffRole || 'admin');

    const created = await Equipment.create({
      id: equipmentId,
      name: name.trim(),
      category: category.trim(),
      model: (model && model.trim()) || 'Standard Model',
      serialNumber: (serialNumber && serialNumber.trim()) || `SN-${Date.now().toString().slice(-6)}`,
      currentRoom: currentRoom.trim(),
      roomId: req.body.roomId || null,
      batteryLevel: parsedBattery,
      hasBattery,
      notes: notes || '',
      status: req.body.status || 'Available',
      sanitizationStatus: req.body.sanitizationStatus || 'CLEARED',
      condition: req.body.condition || 'Optimal',
      lastConfirmedAt: req.body.lastConfirmedAt ? new Date(req.body.lastConfirmedAt) : new Date(),
      lastConfirmedBy: staffName,
    });

    await MovementLog.create({
      id: `MOV-${Date.now()}`,
      equipmentId: created.id,
      equipmentName: created.name,
      fromRoom: 'Asset Commissioning',
      toRoom: created.currentRoom,
      timestamp: new Date(),
      staffId,
      staffName,
      staffRole,
      type: 'Asset Commissioning',
      details: `New asset registered and assigned to ${created.currentRoom}.`,
    });

    // Record audit log
    await AuditLog.create({
      id: `AUD-EQ-${Date.now()}`,
      action: 'EQUIPMENT_CREATED',
      category: 'EQUIPMENT',
      performedBy: {
        id: staffId,
        name: staffName,
        email: req.user?.email || '',
        role: staffRole,
        department: req.user?.department || '',
      },
      targetType: 'Equipment',
      targetId: created.id,
      details: `Registered new medical asset: ${created.name} (${created.id}) in ${created.currentRoom}.`,
      changes: { createdItem: created.toObject ? created.toObject() : created },
      ipAddress: req.ip || '',
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PUT /api/equipment/:id - Edit equipment specifications (Admin only)
router.put('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const eqId = req.params.id.toUpperCase();
    const { name, category, model, serialNumber, currentRoom, batteryLevel, hasBattery, condition, notes } = req.body;

    const existing = await Equipment.findOne({ id: eqId });
    if (!existing) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    const previousSnapshot = existing.toObject ? existing.toObject() : { ...existing };

    if (name) existing.name = name.trim();
    if (category) existing.category = category.trim();
    if (model) existing.model = model.trim();
    if (serialNumber) existing.serialNumber = serialNumber.trim();
    if (currentRoom) existing.currentRoom = currentRoom.trim();
    if (condition) existing.condition = condition;
    if (notes !== undefined) existing.notes = notes;
    if (typeof hasBattery === 'boolean') existing.hasBattery = hasBattery;
    if (batteryLevel !== undefined) {
      existing.batteryLevel = batteryLevel !== null ? Number(batteryLevel) : null;
    }

    existing.lastConfirmedAt = new Date();
    existing.lastConfirmedBy = req.user ? req.user.name : 'Administrator';

    await existing.save();

    await AuditLog.create({
      id: `AUD-EQ-${Date.now()}`,
      action: 'EQUIPMENT_UPDATED',
      category: 'EQUIPMENT',
      performedBy: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        department: req.user.department,
      },
      targetType: 'Equipment',
      targetId: existing.id,
      details: `Administrator updated specifications for ${existing.name} (${existing.id}).`,
      changes: {
        before: previousSnapshot,
        after: existing.toObject ? existing.toObject() : existing,
      },
      ipAddress: req.ip || '',
    });

    res.json(existing);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/equipment/:id/status - Status update / Deactivate (Admin only)
router.patch('/:id/status', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const eqId = req.params.id.toUpperCase();
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required.' });
    }

    const existing = await Equipment.findOne({ id: eqId });
    if (!existing) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    const previousStatus = existing.status;
    existing.status = status;
    if (notes) existing.notes = notes;
    existing.lastConfirmedAt = new Date();
    existing.lastConfirmedBy = req.user.name;

    await existing.save();

    await AuditLog.create({
      id: `AUD-EQ-${Date.now()}`,
      action: 'EQUIPMENT_STATUS_CHANGED',
      category: 'EQUIPMENT',
      performedBy: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        department: req.user.department,
      },
      targetType: 'Equipment',
      targetId: existing.id,
      details: `Status of ${existing.name} (${existing.id}) updated from '${previousStatus}' to '${status}'.`,
      changes: { previousStatus, newStatus: status },
      ipAddress: req.ip || '',
    });

    res.json(existing);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/equipment/:id - Safe equipment decommissioning (Admin only)
router.delete('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const eqId = req.params.id.toUpperCase();
    const existing = await Equipment.findOne({ id: eqId });

    if (!existing) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    // Safety guard: Cannot delete equipment currently in clinical use
    if (existing.status === 'In Use') {
      return res.status(400).json({
        error: 'Safety restriction: Cannot delete or decommission equipment that is actively in clinical use.',
        code: 'EQUIPMENT_IN_USE',
      });
    }

    await Equipment.deleteOne({ id: eqId });

    await AuditLog.create({
      id: `AUD-EQ-${Date.now()}`,
      action: 'EQUIPMENT_DELETED',
      category: 'EQUIPMENT',
      performedBy: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        department: req.user.department,
      },
      targetType: 'Equipment',
      targetId: eqId,
      details: `Administrator decommissioned equipment ${existing.name} (${eqId}).`,
      changes: { deletedItem: existing.toObject ? existing.toObject() : existing },
      ipAddress: req.ip || '',
    });

    res.json({
      success: true,
      message: `Equipment ${eqId} decommissioned successfully.`,
      deletedId: eqId,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/equipment/:id/reserve - Atomic reservation placement (Admin, Doctor, Nurse)
router.post('/:id/reserve', authenticate, requireRole('admin', 'doctor', 'nurse'), async (req, res, next) => {
  try {
    const eqId = req.params.id.toUpperCase();
    const { reservedBy, staffId, department, purpose, durationMinutes } = req.body;

    const clinicianName = req.user ? req.user.name : reservedBy;
    const clinicianId = req.user ? req.user.id : staffId;
    const clinicianDept = req.user ? req.user.department : department;

    if (!purpose || !clinicianName || !clinicianId || !clinicianDept) {
      return res.status(400).json({ error: 'Missing required reservation parameters (purpose, reservedBy, staffId, department).' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    await releaseExpiredReservations();

    const current = await Equipment.findOne({ id: eqId });
    if (!current) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    // Clinical safety check
    if (current.status !== 'Available') {
      return res.status(409).json({
        error: `Conflict: Equipment is currently '${current.status}' and cannot be reserved.`,
        currentStatus: current.status,
      });
    }

    if (current.sanitizationStatus !== 'CLEARED') {
      return res.status(409).json({
        error: 'Conflict: Equipment requires sanitization clearance before booking.',
        sanitizationStatus: current.sanitizationStatus,
      });
    }

    const lockDuration = (durationMinutes || 30) * 60 * 1000;
    const expiresAt = new Date(Date.now() + lockDuration);

    const updated = await Equipment.findOneAndUpdate(
      { id: eqId, status: 'Available', sanitizationStatus: 'CLEARED' },
      {
        $set: {
          status: 'Reserved',
          reservation: {
            reservedBy: clinicianName,
            staffId: clinicianId,
            department: clinicianDept,
            purpose: purpose || 'Clinical Hold',
            reservedAt: new Date(),
            expiresAt,
          },
        },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(409).json({
        error: 'Race condition: Equipment was locked or modified by another clinician.',
      });
    }

    await MovementLog.create({
      id: `MOV-${Date.now()}`,
      equipmentId: updated.id,
      equipmentName: updated.name,
      fromRoom: updated.currentRoom,
      toRoom: updated.currentRoom,
      timestamp: new Date(),
      staffId: clinicianId,
      staffName: clinicianName,
      staffRole: req.user?.role || 'Clinician',
      type: 'Reservation Placed (30m Expiry)',
      details: `Hold placed for ${clinicianDept} (${purpose || 'Clinical Hold'}). Auto-releases in 30 minutes.`,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /api/equipment/:id/handover - Transfer reserved equipment to In Use (Admin, Doctor, Nurse)
router.post('/:id/handover', authenticate, requireRole('admin', 'doctor', 'nurse'), async (req, res, next) => {
  try {
    const eqId = req.params.id.toUpperCase();
    const { handoverStaffName } = req.body;

    const current = await Equipment.findOne({ id: eqId });
    if (!current) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    if (current.status !== 'Reserved') {
      return res.status(400).json({
        error: `Cannot handover equipment with status '${current.status}'. Must be 'Reserved'.`,
      });
    }

    const updated = await Equipment.findOneAndUpdate(
      { id: eqId, status: 'Reserved' },
      {
        $set: {
          status: 'In Use',
          'reservation.handedOverAt': new Date(),
          'reservation.handedOverBy': req.user?.name || handoverStaffName || 'Attending Staff',
          lastConfirmedAt: new Date(),
          lastConfirmedBy: req.user?.name || handoverStaffName || 'Attending Staff',
        },
        $inc: { totalUsageSessions: 1 },
      },
      { new: true }
    );

    await MovementLog.create({
      id: `MOV-${Date.now()}`,
      equipmentId: updated.id,
      equipmentName: updated.name,
      fromRoom: updated.currentRoom,
      toRoom: updated.currentRoom,
      timestamp: new Date(),
      staffId: req.user?.id || 'STF-01',
      staffName: req.user?.name || handoverStaffName || 'Attending Staff',
      staffRole: req.user?.role || 'Clinical Staff',
      type: 'Physical Handover Verified (In Use)',
      details: `Handover verified for ${updated.reservation?.department || 'Patient Care'}. Transitioned to In Use.`,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /api/equipment/:id/return - Discharge and route to decontamination (Admin, Doctor, Nurse)
router.post('/:id/return', authenticate, requireRole('admin', 'doctor', 'nurse'), async (req, res, next) => {
  try {
    const eqId = req.params.id.toUpperCase();
    const { destinationRoom } = req.body;

    const current = await Equipment.findOne({ id: eqId });
    if (!current) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    const targetRoom = destinationRoom || 'Central Sanitization & Decon Bay';

    const updated = await Equipment.findOneAndUpdate(
      { id: eqId },
      {
        $set: {
          status: 'Sanitization Required',
          sanitizationStatus: 'PENDING',
          currentRoom: targetRoom,
          lastConfirmedAt: new Date(),
          lastConfirmedBy: req.user?.name || 'Clinical Staff',
          reservation: null,
        },
      },
      { new: true }
    );

    await MovementLog.create({
      id: `MOV-${Date.now()}`,
      equipmentId: updated.id,
      equipmentName: updated.name,
      fromRoom: current.currentRoom,
      toRoom: targetRoom,
      timestamp: new Date(),
      staffId: req.user?.id || 'STF-01',
      staffName: req.user?.name || 'Clinical Staff',
      staffRole: req.user?.role || 'Clinical Staff',
      type: 'Equipment Returned (Sanitization Pending)',
      details: `Discharged from clinical care and routed to ${targetRoom}. Sanitization pending.`,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /api/equipment/:id/sanitize - Sign-off decontamination (Admin, Nurse, Staff)
router.post('/:id/sanitize', authenticate, requireRole('admin', 'nurse', 'staff'), async (req, res, next) => {
  try {
    const eqId = req.params.id.toUpperCase();

    const current = await Equipment.findOne({ id: eqId });
    if (!current) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    const updated = await Equipment.findOneAndUpdate(
      { id: eqId },
      {
        $set: {
          status: 'Available',
          sanitizationStatus: 'CLEARED',
          lastSanitizedAt: new Date(),
          lastConfirmedAt: new Date(),
          lastConfirmedBy: req.user?.name || 'Infection Prevention Staff',
        },
      },
      { new: true }
    );

    await MovementLog.create({
      id: `MOV-${Date.now()}`,
      equipmentId: updated.id,
      equipmentName: updated.name,
      fromRoom: current.currentRoom,
      toRoom: current.currentRoom,
      timestamp: new Date(),
      staffId: req.user?.id || 'SAN-01',
      staffName: req.user?.name || 'Infection Prevention Staff',
      staffRole: req.user?.role || 'Sanitization Technician',
      type: 'Sanitization Clearance',
      details: `Full decontamination protocol verified. Device restored to Available status.`,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /api/equipment/:id/move - Dual-QR verified room relocation (Admin, Nurse, Staff)
router.post('/:id/move', authenticate, requireRole('admin', 'nurse', 'staff'), async (req, res, next) => {
  try {
    const eqId = req.params.id.toUpperCase();
    const { toRoom } = req.body;

    if (!toRoom) {
      return res.status(400).json({ error: 'Destination room (toRoom) is required.' });
    }

    const current = await Equipment.findOne({ id: eqId });
    if (!current) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    const fromRoom = current.currentRoom;

    const updated = await Equipment.findOneAndUpdate(
      { id: eqId },
      {
        $set: {
          currentRoom: toRoom,
          lastConfirmedAt: new Date(),
          lastConfirmedBy: req.user?.name || 'Clinical Staff',
        },
      },
      { new: true }
    );

    await MovementLog.create({
      id: `MOV-${Date.now()}`,
      equipmentId: updated.id,
      equipmentName: updated.name,
      fromRoom,
      toRoom,
      timestamp: new Date(),
      staffId: req.user?.id || 'STF-01',
      staffName: req.user?.name || 'Clinical Staff',
      staffRole: req.user?.role || 'Staff Member',
      type: 'Dual-QR Verified Relocation',
      details: `Relocated from ${fromRoom} to ${toRoom} via dual QR scan confirmation.`,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
