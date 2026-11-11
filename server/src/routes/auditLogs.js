import express from 'express';
import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/audit-logs - Query system and clinical audit logs
router.get('/', authenticate, requireRole('admin', 'doctor'), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }
    const { category, action, search, limit = 50 } = req.query;
    const filter = {};

    // Doctors only view clinical/equipment categories, admins view all
    if (req.user.role === 'doctor') {
      filter.category = { $in: ['EQUIPMENT', 'CLINICAL_OPERATION'] };
    } else if (category && category !== 'All') {
      filter.category = category;
    }

    if (action && action !== 'All') {
      filter.action = action;
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { details: new RegExp(q, 'i') },
        { action: new RegExp(q, 'i') },
        { targetId: new RegExp(q, 'i') },
        { 'performedBy.name': new RegExp(q, 'i') },
        { 'performedBy.role': new RegExp(q, 'i') },
      ];
    }

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(Math.min(Number(limit) || 50, 200));

    res.json(logs);
  } catch (err) {
    next(err);
  }
});

export default router;
