import express from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Enforce admin privileges on all user management endpoints
router.use(authenticate, requireRole('admin'));

// GET /api/users - List all hospital users
router.get('/', async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }
    const { role, status, search } = req.query;
    const filter = {};

    if (role && role !== 'All') filter.role = role;
    if (status && status !== 'All') filter.status = status;
    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
        { id: new RegExp(q, 'i') },
        { department: new RegExp(q, 'i') },
      ];
    }

    const users = await User.find(filter).sort({ createdAt: -1 });
    res.json(users.map((u) => u.toSafeObject()));
  } catch (err) {
    next(err);
  }
});

// POST /api/users - Admin provisioning of new staff/admin account
router.post('/', async (req, res, next) => {
  try {
    const { name, email, password, role, department } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        error: 'Missing required account fields (name, email, password, role).',
        code: 'MISSING_FIELDS',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long.',
        code: 'WEAK_PASSWORD',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({
        error: `An account with email '${cleanEmail}' already exists.`,
        code: 'EMAIL_EXISTS',
      });
    }

    // Generate unique ID based on role prefix
    const rolePrefixes = {
      admin: 'ADM',
      doctor: 'DOC',
      nurse: 'NUR',
      staff: 'STF',
    };
    const prefix = rolePrefixes[role] || 'STF';
    const id = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newUser = await User.create({
      id,
      name: name.trim(),
      email: cleanEmail,
      password,
      role,
      department: (department && department.trim()) || 'Clinical Services',
      status: 'active',
      badge: role.toUpperCase(),
    });

    // Record audit log
    await AuditLog.create({
      id: `AUD-USR-${Date.now()}`,
      action: 'USER_CREATED',
      category: 'USER_MANAGEMENT',
      performedBy: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        department: req.user.department,
      },
      targetType: 'User',
      targetId: newUser.id,
      details: `Administrator created new ${role.toUpperCase()} account for ${newUser.name} (${newUser.email}).`,
      changes: { createdUser: newUser.toSafeObject() },
      ipAddress: req.ip || '',
    });

    res.status(201).json(newUser.toSafeObject());
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/:id/status - Toggle active/inactive account status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        error: "Status must be either 'active' or 'inactive'.",
        code: 'INVALID_STATUS',
      });
    }

    const targetUser = await User.findOne({ id: req.params.id.toUpperCase() });
    if (!targetUser) {
      return res.status(404).json({ error: 'User account not found.', code: 'USER_NOT_FOUND' });
    }

    // Safety guard: cannot deactivate self
    if (targetUser.id === req.user.id && status === 'inactive') {
      return res.status(400).json({
        error: 'Safety restriction: You cannot deactivate your own administrative account.',
        code: 'SELF_DEACTIVATION_PREVENTED',
      });
    }

    const previousStatus = targetUser.status;
    targetUser.status = status;
    await targetUser.save();

    await AuditLog.create({
      id: `AUD-USR-${Date.now()}`,
      action: status === 'active' ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      category: 'USER_MANAGEMENT',
      performedBy: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        department: req.user.department,
      },
      targetType: 'User',
      targetId: targetUser.id,
      details: `Administrator updated account status of ${targetUser.name} from '${previousStatus}' to '${status}'.`,
      changes: { previousStatus, newStatus: status },
      ipAddress: req.ip || '',
    });

    res.json(targetUser.toSafeObject());
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/:id/role - Update user role
router.patch('/:id/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['admin', 'doctor', 'nurse', 'staff'].includes(role)) {
      return res.status(400).json({
        error: "Role must be one of: 'admin', 'doctor', 'nurse', 'staff'.",
        code: 'INVALID_ROLE',
      });
    }

    const targetUser = await User.findOne({ id: req.params.id.toUpperCase() });
    if (!targetUser) {
      return res.status(404).json({ error: 'User account not found.', code: 'USER_NOT_FOUND' });
    }

    // Safety guard: cannot demote self
    if (targetUser.id === req.user.id && role !== 'admin') {
      return res.status(400).json({
        error: 'Safety restriction: You cannot demote your own administrative role.',
        code: 'SELF_DEMOTION_PREVENTED',
      });
    }

    const previousRole = targetUser.role;
    targetUser.role = role;
    await targetUser.save();

    await AuditLog.create({
      id: `AUD-USR-${Date.now()}`,
      action: 'USER_ROLE_CHANGED',
      category: 'USER_MANAGEMENT',
      performedBy: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        department: req.user.department,
      },
      targetType: 'User',
      targetId: targetUser.id,
      details: `Administrator updated role of ${targetUser.name} from '${previousRole}' to '${role}'.`,
      changes: { previousRole, newRole: role },
      ipAddress: req.ip || '',
    });

    res.json(targetUser.toSafeObject());
  } catch (err) {
    next(err);
  }
});

export default router;
