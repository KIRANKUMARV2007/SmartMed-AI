import express from 'express';
import { MovementLog } from '../models/MovementLog.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// GET /api/movements - append-only movement history ledger
router.get('/', async (req, res, next) => {
  try {
    const { equipmentId, type, room, limit } = req.query;
    const filter = {};

    if (equipmentId) {
      filter.equipmentId = equipmentId.toUpperCase();
    }
    if (type && type !== 'All') {
      filter.type = type;
    }
    if (room && room !== 'All') {
      filter.$or = [{ fromRoom: room }, { toRoom: room }];
    }

    const maxResults = Math.min(parseInt(limit, 10) || 100, 500);

    const movements = await MovementLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(maxResults);

    res.json(movements);
  } catch (err) {
    next(err);
  }
});

// POST /api/movements - append an audit record (append-only ledger)
router.post('/', async (req, res, next) => {
  try {
    const { equipmentId, equipmentName, fromRoom, toRoom, staffId, staffName, staffRole, type, details } = req.body;

    if (!equipmentId || !equipmentName || !fromRoom || !toRoom || !type) {
      return res.status(400).json({ error: 'Missing required audit entry fields.' });
    }

    const log = await MovementLog.create({
      id: `MOV-${Date.now()}`,
      equipmentId: equipmentId.toUpperCase(),
      equipmentName,
      fromRoom,
      toRoom,
      timestamp: new Date(),
      staffId: staffId || 'SYS-01',
      staffName: staffName || 'System',
      staffRole: staffRole || 'Staff Member',
      type,
      details: details || '',
    });

    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
});

export default router;
