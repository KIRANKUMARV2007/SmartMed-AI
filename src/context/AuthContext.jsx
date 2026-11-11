import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { authApi } from '../api/authApi.js';
import { setAuthToken } from '../api/client.js';

const AuthContext = createContext(null);

// Centralized Frontend Permission Matrix mirroring the backend
export const PERMISSION_MATRIX = {
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
  EMERGENCY_ALLOCATE: ['admin', 'doctor', 'nurse'],
  REPORTS_VIEW: ['admin', 'doctor', 'nurse', 'staff'],
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Initialize and restore authenticated session on page refresh
  const restoreSession = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      // Check stored token in localStorage as secondary fallback
      const savedToken = typeof window !== 'undefined' ? localStorage.getItem('smartmed_jwt_token') : null;
      if (savedToken) {
        setAuthToken(savedToken);
      }

      const response = await authApi.getMe();
      if (response && response.user) {
        setUser(response.user);
      } else {
        setUser(null);
        setAuthToken(null);
        if (typeof window !== 'undefined') localStorage.removeItem('smartmed_jwt_token');
      }
    } catch {
      // Unauthenticated on initial load is standard; do not show intrusive error
      setUser(null);
      setAuthToken(null);
      if (typeof window !== 'undefined') localStorage.removeItem('smartmed_jwt_token');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Login handler
  const login = useCallback(async ({ email, password, portalType }) => {
    setAuthError(null);
    try {
      const result = await authApi.login({ email, password, portalType });

      if (result && result.user) {
        setUser(result.user);
        if (result.token) {
          setAuthToken(result.token);
          if (typeof window !== 'undefined') {
            localStorage.setItem('smartmed_jwt_token', result.token);
          }
        }
        return { success: true, user: result.user };
      }

      throw new Error(result?.error || 'Authentication failed.');
    } catch (err) {
      const msg = err?.message || 'Invalid clinical credentials.';
      setAuthError(msg);
      return { success: false, error: msg };
    }
  }, []);

  // Logout handler
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Continue client cleanup even if network fails
    } finally {
      setUser(null);
      setAuthToken(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('smartmed_jwt_token');
      }
    }
  }, []);

  // Permission verification helper
  const hasPermission = useCallback(
    (permissionKey) => {
      if (!user) return false;
      const allowedRoles = PERMISSION_MATRIX[permissionKey] || [];
      return allowedRoles.includes(user.role);
    },
    [user]
  );

  // Role verification helper
  const hasRole = useCallback(
    (...allowedRoles) => {
      if (!user) return false;
      return allowedRoles.includes(user.role);
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      role: user?.role || null,
      isAdmin: user?.role === 'admin',
      isDoctor: user?.role === 'doctor',
      isNurse: user?.role === 'nurse',
      isStaff: user?.role === 'staff',
      isAuthenticated: !!user,
      isLoading,
      authError,
      setAuthError,
      login,
      logout,
      hasPermission,
      hasRole,
      restoreSession,
    }),
    [user, isLoading, authError, login, logout, hasPermission, hasRole, restoreSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
