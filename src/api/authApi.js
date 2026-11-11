import { apiRequest } from './client.js';

export const authApi = {
  /**
   * Log in with clinical credentials.
   * @param {Object} credentials - { email, password, portalType }
   * @returns {Promise<{ success: boolean, user: Object, token: string }>}
   */
  async login(credentials) {
    if (!credentials || !credentials.email || !credentials.password) {
      throw new Error('Email and password are required');
    }
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  /**
   * Log out and terminate current session.
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async logout() {
    return apiRequest('/auth/logout', {
      method: 'POST',
    });
  },

  /**
   * Verify session and retrieve current authenticated user.
   * @returns {Promise<{ success: boolean, user: Object }>}
   */
  async getMe() {
    return apiRequest('/auth/me');
  },

  /**
   * List all hospital user accounts (Admin only).
   * @param {Object} [filters={}]
   * @returns {Promise<Array>}
   */
  async getUsers(filters = {}) {
    const params = new URLSearchParams();
    if (filters.role && filters.role !== 'All') params.set('role', filters.role);
    if (filters.status && filters.status !== 'All') params.set('status', filters.status);
    if (filters.search && filters.search.trim()) params.set('search', filters.search.trim());

    const qs = params.toString();
    return apiRequest(`/users${qs ? `?${qs}` : ''}`);
  },

  /**
   * Provision a new staff or admin user account (Admin only).
   * @param {Object} userData - { name, email, password, role, department }
   * @returns {Promise<Object>}
   */
  async createUser(userData) {
    return apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  /**
   * Update active or inactive status of user account (Admin only).
   * @param {string} id - User ID
   * @param {string} status - 'active' | 'inactive'
   * @returns {Promise<Object>}
   */
  async updateUserStatus(id, status) {
    return apiRequest(`/users/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  /**
   * Update role of user account (Admin only).
   * @param {string} id - User ID
   * @param {string} role - 'admin' | 'doctor' | 'nurse' | 'staff'
   * @returns {Promise<Object>}
   */
  async updateUserRole(id, role) {
    return apiRequest(`/users/${encodeURIComponent(id)}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  /**
   * Retrieve system and clinical audit logs (Admin or Doctor).
   * @param {Object} [filters={}]
   * @returns {Promise<Array>}
   */
  async getAuditLogs(filters = {}) {
    const params = new URLSearchParams();
    if (filters.category && filters.category !== 'All') params.set('category', filters.category);
    if (filters.action && filters.action !== 'All') params.set('action', filters.action);
    if (filters.search && filters.search.trim()) params.set('search', filters.search.trim());
    if (filters.limit) params.set('limit', filters.limit);

    const qs = params.toString();
    return apiRequest(`/audit-logs${qs ? `?${qs}` : ''}`);
  },
};
