import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { authenticate, JWT_SECRET, JWT_EXPIRY } from '../middleware/auth.js';

const router = express.Router();

// Cookie configuration
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
};

// POST /api/auth/login - Authenticate staff or administrator
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, portalType } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required.',
        code: 'MISSING_CREDENTIALS',
      });
    }

    // Safety guard: ensure database is connected before querying to avoid 10s buffering timeouts
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: 'Authentication database is currently unavailable. Please verify MongoDB Atlas IP allowlist and network connection.',
        code: 'DATABASE_UNAVAILABLE',
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Query user including password field for verification
    const user = await User.findOne({ email: cleanEmail }).select('+password');

    if (!user) {
      // Audit log failed attempt without revealing account existence
      try {
        await AuditLog.create({
          id: `AUD-AUTH-${Date.now()}`,
          action: 'LOGIN_FAILED',
          category: 'AUTH',
          performedBy: { id: 'UNKNOWN', name: 'Anonymous', email: cleanEmail, role: 'unauthenticated' },
          targetType: 'Session',
          details: `Failed login attempt for non-existent or mis-typed email: ${cleanEmail}`,
          ipAddress: req.ip || '',
        });
      } catch (logErr) {
        console.warn('[Auth Audit Warning] Could not write failed login log:', logErr.message);
      }

      return res.status(401).json({
        error: 'Invalid clinical credentials. Please verify your email and password.',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Verify password hash
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      try {
        await AuditLog.create({
          id: `AUD-AUTH-${Date.now()}`,
          action: 'LOGIN_FAILED',
          category: 'AUTH',
          performedBy: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department },
          targetType: 'Session',
          details: `Failed password verification for user ${user.id} (${cleanEmail}).`,
          ipAddress: req.ip || '',
        });
      } catch (logErr) {
        console.warn('[Auth Audit Warning] Could not write failed login log:', logErr.message);
      }

      return res.status(401).json({
        error: 'Invalid clinical credentials. Please verify your email and password.',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Account active check
    if (user.status !== 'active') {
      return res.status(403).json({
        error: 'Your account is currently inactive. Please contact the SmartMed administrator.',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    // Portal validation: if user selected Admin Portal, enforce admin role
    if (portalType === 'admin' && user.role !== 'admin') {
      return res.status(403).json({
        error: `Access Denied: The Administrator Portal requires an Administrator account. Your server role is '${user.role}'. Please use the Hospital Staff login.`,
        code: 'PORTAL_MISMATCH',
        userRole: user.role,
      });
    }

    // Generate signed JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    // Update lastLogin
    user.lastLogin = new Date();
    await user.save();

    // Set secure HttpOnly cookie
    res.cookie('smartmed_token', token, COOKIE_OPTIONS);

    // Record login audit log
    try {
      await AuditLog.create({
        id: `AUD-AUTH-${Date.now()}`,
        action: 'USER_LOGIN',
        category: 'AUTH',
        performedBy: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department },
        targetType: 'Session',
        targetId: user.id,
        details: `Successful authenticated login as ${user.role.toUpperCase()} into ${portalType || 'default'} portal.`,
        ipAddress: req.ip || '',
      });
    } catch (logErr) {
      console.warn('[Auth Audit Warning] Could not record user login audit log:', logErr.message);
    }

    res.json({
      success: true,
      user: user.toSafeObject(),
      token,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout - Invalidate session
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    // Record logout audit log
    if (req.user) {
      await AuditLog.create({
        id: `AUD-AUTH-${Date.now()}`,
        action: 'USER_LOGOUT',
        category: 'AUTH',
        performedBy: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          department: req.user.department,
        },
        targetType: 'Session',
        targetId: req.user.id,
        details: 'User cleanly terminated active clinical session.',
        ipAddress: req.ip || '',
      });
    }

    res.clearCookie('smartmed_token', COOKIE_OPTIONS);
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me - Retrieve current verified user session
router.get('/me', authenticate, async (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

export default router;
