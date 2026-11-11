import express from 'express';
import { Room } from '../models/Room.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// GET /api/rooms - list hospital rooms & zones
router.get('/', async (req, res, next) => {
  try {
    const { department, type, floor } = req.query;
    const filter = {};

    if (department && department !== 'All') {
      filter.department = department;
    }
    if (type && type !== 'All') {
      filter.type = type;
    }
    if (floor && floor !== 'All') {
      filter.floor = floor;
    }

    const rooms = await Room.find(filter).sort({ floor: 1, name: 1 });
    res.json(rooms);
  } catch (err) {
    next(err);
  }
});

// GET /api/rooms/:id - get single room
router.get('/:id', async (req, res, next) => {
  try {
    const room = await Room.findOne({ id: req.params.id.toUpperCase() });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (err) {
    next(err);
  }
});

export default router;
