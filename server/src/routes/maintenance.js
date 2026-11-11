import express from 'express';
import { MaintenanceTicket } from '../models/MaintenanceTicket.js';
import { Equipment } from '../models/Equipment.js';
import { MovementLog } from '../models/MovementLog.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// GET /api/maintenance - list maintenance tickets
router.get('/', async (req, res, next) => {
  try {
    const { status, severity } = req.query;
    const filter = {};

    if (status && status !== 'All') {
      filter.status = status;
    }
    if (severity && severity !== 'All') {
      filter.severity = severity;
    }

    const tickets = await MaintenanceTicket.find(filter).sort({ reportedAt: -1 });
    res.json(tickets);
  } catch (err) {
    next(err);
  }
});

// POST /api/maintenance - report equipment fault / create ticket
router.post('/', async (req, res, next) => {
  try {
    const { equipmentId, severity, title, description, currentRoom, reportedBy } = req.body;

    if (!equipmentId || !title || !description) {
      return res.status(400).json({ error: 'Missing required maintenance ticket fields.' });
    }

    const eq = await Equipment.findOne({ id: equipmentId.toUpperCase() });
    if (!eq) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    // Set equipment status to Faulty or Under Maintenance
    eq.status = severity === 'CRITICAL' ? 'Faulty' : 'Under Maintenance';
    await eq.save();

    const ticket = await MaintenanceTicket.create({
      id: `BM-${Date.now().toString().slice(-4)}`,
      equipmentId: eq.id,
      equipmentName: eq.name,
      severity: severity || 'MEDIUM',
      title,
      description,
      currentRoom: currentRoom || eq.currentRoom,
      reportedAt: new Date(),
      status: 'ACTIVE_FAULT',
    });

    await MovementLog.create({
      id: `MOV-${Date.now()}`,
      equipmentId: eq.id,
      equipmentName: eq.name,
      fromRoom: eq.currentRoom,
      toRoom: 'Biomedical Workshop B1',
      timestamp: new Date(),
      staffId: req.body.staffId || 'ENG-01',
      staffName: reportedBy || 'Biomedical Staff',
      staffRole: 'Biomedical Engineer',
      type: 'Maintenance Escalation Transfer',
      details: `Reported issue: ${title}. Severity: ${severity || 'MEDIUM'}.`,
    });

    res.status(201).json(ticket);
  } catch (err) {
    next(err);
  }
});

// POST /api/maintenance/:id/clear - authorized biomedical clearance (Admin or Biomed Staff)
router.post('/:id/clear', requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const { engineerName, staffId, notes } = req.body;

    const ticket = await MaintenanceTicket.findOne({ id: ticketId });
    if (!ticket) {
      return res.status(404).json({ error: 'Maintenance ticket not found' });
    }

    ticket.status = 'RESOLVED';
    ticket.resolvedAt = new Date();
    ticket.resolvedBy = engineerName || 'Mark Davis, CBET';
    ticket.resolutionNotes = notes || 'Repairs completed and certified by Biomedical Engineering.';
    await ticket.save();

    // Re-enable equipment as Available & Optimal
    const eq = await Equipment.findOne({ id: ticket.equipmentId });
    if (eq) {
      eq.status = 'Available';
      eq.condition = 'Optimal';
      eq.lastConfirmedAt = new Date();
      eq.lastConfirmedBy = engineerName || 'Biomedical Engineering';
      await eq.save();

      await MovementLog.create({
        id: `MOV-${Date.now()}`,
        equipmentId: eq.id,
        equipmentName: eq.name,
        fromRoom: eq.currentRoom,
        toRoom: eq.currentRoom,
        timestamp: new Date(),
        staffId: staffId || 'ENG-4412',
        staffName: engineerName || 'Mark Davis, CBET',
        staffRole: 'Lead Biomedical Engineer',
        type: 'Biomedical Maintenance Cleared',
        details: `Work order ${ticket.id} passed certified inspection. Restored to Available status.`,
      });
    }

    res.json({ message: 'Ticket resolved and equipment cleared for clinical service.', ticket, equipment: eq });
  } catch (err) {
    next(err);
  }
});

export default router;
