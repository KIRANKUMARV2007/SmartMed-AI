import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'smartmed_secure_jwt_token_secret_key_2026';
export const JWT_EXPIRY = '24h';

export const PERMISSIONS = {
  EQUIPMENT_VIEW: ['admin', 'doctor', 'nurse', 'staff'],
  EQUIPMENT_CREATE: ['admin'],
  EQUIPMENT_EDIT: ['admin'],
  EQUIPMENT_DEACTIVATE: ['admin'],
  EQUIPMENT_DELETE: ['admin'],
  EQUIPMENT_RESERVE: ['admin', 'doctor', 'nurse'],
  EQUIPMENT_HANDOVER: ['admin', 'doctor', 'nurse'],
  EQUIPMENT_MOVE: ['admin', 'nurse', 'staff'],
  EQUIPMENT_SANATIZE: ['admin', 'nurse', 'staff'],
  MAINTENANCE_REQUEST: ['admin', 'doctor', 'nurse', 'staff'],
  MAINTENANCE_RESOLVE: ['admin', 'staff'],
  USER_MANAGE: ['admin'],
  AUDIT_VIEW: ['admin', 'doctor'],
  EMERGENCY_ALLOCATE: ['admin', 'doctor'],
};

/**
 * Authentication Middleware: verifies signed JWT token from cookie or Authorization header.
 * Attaches authenticated user object to req.user.
 */
export async function authenticate(req, res, next) {
  try {
    let token = null;

    // 1. Try reading from HttpOnly cookie
    if (req.cookies && req.cookies.smartmed_token) {
      token = req.cookies.smartmed_token;
    }

    // 2. Fall back to Bearer Authorization header
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required. Please sign in to access this clinical resource.',
        code: 'UNAUTHENTICATED',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
      return res.status(401).json({
        error: jwtErr.name === 'TokenExpiredError' ? 'Session expired. Please sign in again.' : 'Invalid session token.',
        code: 'TOKEN_INVALID',
      });
    }

    // Check trusted server-side user record if DB is connected
    if (mongoose.connection.readyState === 1) {
      const user = await User.findOne({ id: decoded.id });
      if (!user) {
        return res.status(401).json({
          error: 'User account no longer exists.',
          code: 'ACCOUNT_NOT_FOUND',
        });
      }

      if (user.status !== 'active') {
        return res.status(403).json({
          error: 'Account has been deactivated. Please contact your hospital administrator.',
          code: 'ACCOUNT_DEACTIVATED',
        });
      }

      req.user = user.toSafeObject();
    } else {
      // Offline/isolated test execution fallback
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name || 'Test User',
        department: decoded.department || 'Clinical Operations',
        status: decoded.status || 'active',
      };

      if (req.user.status !== 'active') {
        return res.status(403).json({
          error: 'Account has been deactivated. Please contact your hospital administrator.',
          code: 'ACCOUNT_DEACTIVATED',
        });
      }
    }

    req.token = token;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Role-Based Access Control Middleware
 * Requires the authenticated user to hold at least one of the specified roles.
 * @param {...string} allowedRoles - e.g. 'admin', 'doctor'
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHENTICATED' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Insufficient permissions for role '${req.user.role}'. Required: [${allowedRoles.join(', ')}].`,
        code: 'FORBIDDEN',
        userRole: req.user.role,
        requiredRoles: allowedRoles,
      });
    }

    next();
  };
}

/**
 * Permission-Based Access Control Middleware
 * Checks user role against the centralized PERMISSIONS matrix.
 * @param {string} permissionKey - e.g. 'EQUIPMENT_DELETE', 'USER_MANAGE'
 */
export function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHENTICATED' });
    }

    const allowedRoles = PERMISSIONS[permissionKey] || [];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Your role '${req.user.role}' lacks permission for '${permissionKey}'.`,
        code: 'PERMISSION_DENIED',
        permission: permissionKey,
        userRole: req.user.role,
      });
    }

    next();
  };
}
