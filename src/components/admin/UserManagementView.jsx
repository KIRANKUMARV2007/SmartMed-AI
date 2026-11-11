import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Stethoscope,
  Activity,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  X,
  Lock,
  Mail,
  User as UserIcon,
  Building,
} from 'lucide-react';
import { authApi } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';

export default function UserManagementView() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Create User Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'nurse',
    department: 'Intensive Care Unit (ICU)',
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await authApi.getUsers({
        role: roleFilter,
        status: statusFilter,
        search: searchQuery,
      });
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Failed to retrieve user accounts from server.');
    } finally {
      setIsLoading(false);
    }
  }, [roleFilter, statusFilter, searchQuery]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Handle Create User
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newUserData.name.trim() || !newUserData.email.trim() || !newUserData.password) {
      setCreateError('Please complete all required fields.');
      return;
    }
    if (newUserData.password.length < 6) {
      setCreateError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setCreateSubmitting(true);
      setCreateError('');

      await authApi.createUser(newUserData);
      setSuccessMessage(`Account created successfully for ${newUserData.name} (${newUserData.role.toUpperCase()}).`);
      setIsCreateOpen(false);
      setNewUserData({
        name: '',
        email: '',
        password: '',
        role: 'nurse',
        department: 'Intensive Care Unit (ICU)',
      });
      loadUsers();
    } catch (err) {
      setCreateError(err?.message || 'Failed to create user account.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Handle Status Toggle
  const handleToggleStatus = async (user) => {
    if (user.id === currentUser?.id) {
      setError('You cannot deactivate your own administrative account.');
      return;
    }

    const nextStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      setError('');
      await authApi.updateUserStatus(user.id, nextStatus);
      setSuccessMessage(`Account for ${user.name} is now ${nextStatus.toUpperCase()}.`);
      loadUsers();
    } catch (err) {
      setError(err?.message || 'Failed to update account status.');
    }
  };

  // Helper for role badge icon
  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <Shield size={14} color="var(--accent-cyan)" />;
      case 'doctor':
        return <Stethoscope size={14} color="var(--status-ready)" />;
      case 'nurse':
        return <Activity size={14} color="var(--status-inuse)" />;
      default:
        return <Users size={14} color="var(--text-muted)" />;
    }
  };

  return (
    <div className="admin-view-wrapper">
      {/* Header with Title and Create Button */}
      <div className="view-header-flex">
        <div>
          <h2 className="view-section-title">
            <Users size={20} color="var(--accent-cyan)" style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Staff & User Management
          </h2>
          <p className="view-section-subtitle">
            Administer hospital accounts, assign clinical roles, and enforce server-side access permissions.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setIsCreateOpen(true);
            setCreateError('');
          }}
        >
          <UserPlus size={16} />
          <span>Provision New Account</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="login-error-alert" style={{ marginBottom: 16 }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.35)',
            color: 'var(--status-ready)',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <CheckCircle2 size={16} />
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage('')}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="admin-filter-toolbar" style={{ marginBottom: 20 }}>
        <div className="admin-filter-left">
          <div className="admin-search-wrap">
            <Search size={15} className="admin-search-icon" />
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search by name, email, ID, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="admin-filter-control">
            <label className="admin-filter-label">Role:</label>
            <select
              className="admin-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="All">All Roles</option>
              <option value="admin">Administrator</option>
              <option value="doctor">Doctor</option>
              <option value="nurse">Nurse</option>
              <option value="staff">Biomed / Staff</option>
            </select>
          </div>

          <div className="admin-filter-control">
            <label className="admin-filter-label">Status:</label>
            <select
              className="admin-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          className="btn-secondary"
          onClick={loadUsers}
          title="Refresh account roster"
        >
          <RotateCcw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="table-card">
        <div className="table-card-header">
          <div className="table-card-title">
            <Users size={16} color="var(--accent-cyan)" />
            <span>Hospital Personnel Accounts ({users.length})</span>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="clinical-table" style={{ minWidth: 780 }}>
            <thead>
              <tr>
                <th style={{ width: '26%' }}>User Details</th>
                <th style={{ width: '12%' }}>Staff ID</th>
                <th style={{ width: '16%' }}>Clinical Role</th>
                <th style={{ width: '18%' }}>Department</th>
                <th style={{ width: '12%' }}>Status</th>
                <th style={{ width: '16%' }}>Last Login</th>
                <th style={{ width: '12%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <RotateCcw size={24} className="animate-spin" color="var(--accent-cyan)" style={{ margin: '0 auto 8px' }} />
                    <p style={{ color: 'var(--text-muted)' }}>Loading verified clinical accounts...</p>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <Users size={32} color="var(--text-muted)" style={{ margin: '0 auto 8px' }} />
                    <p style={{ fontWeight: 600 }}>No accounts found matching search filters.</p>
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  const isActive = u.status === 'active';

                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="user-info-cell">
                          <span className="user-name-title">
                            {u.name} {isSelf && <span className="admin-pill-badge" style={{ fontSize: 10, padding: '1px 6px' }}>You</span>}
                          </span>
                          <span className="user-email-subtitle">{u.email}</span>
                        </div>
                      </td>
                      <td>
                        <span className="equip-id-code">{u.id}</span>
                      </td>
                      <td>
                        <span className={`role-badge-pill ${u.role}`}>
                          {getRoleIcon(u.role)}
                          <span>{u.role === 'admin' ? 'Administrator' : u.role}</span>
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{u.department}</span>
                      </td>
                      <td>
                        <span className={`status-pill-indicator ${isActive ? 'active' : 'inactive'}`}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {u.lastLogin ? new Date(u.lastLogin).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="table-action-group">
                          <button
                            type="button"
                            className={isActive ? 'btn-secondary' : 'btn-primary'}
                            onClick={() => handleToggleStatus(u)}
                            disabled={isSelf}
                            style={{
                              padding: '5px 10px',
                              fontSize: '11.5px',
                              opacity: isSelf ? 0.4 : 1,
                            }}
                            title={isSelf ? 'Cannot deactivate self' : isActive ? 'Deactivate account' : 'Reactivate account'}
                          >
                            {isActive ? (
                              <>
                                <XCircle size={13} style={{ marginRight: 4 }} />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={13} style={{ marginRight: 4 }} />
                                Activate
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Account Modal */}
      {isCreateOpen && (
        <div className="modal-backdrop" onClick={() => !createSubmitting && setIsCreateOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <UserPlus size={18} color="var(--accent-cyan)" />
                <span>Provision Clinical / Admin Account</span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !createSubmitting && setIsCreateOpen(false)}
                disabled={createSubmitting}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                {createError && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--status-faulty-bg)',
                      border: '1px solid var(--status-faulty-border)',
                      color: 'var(--status-faulty)',
                      fontSize: 13,
                    }}
                  >
                    {createError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Full Name & Credentials *</label>
                  <div className="input-with-icon">
                    <UserIcon size={16} className="input-left-icon" />
                    <input
                      type="text"
                      className="form-input with-left-icon"
                      placeholder="e.g. Dr. Robert Chen, MD"
                      value={newUserData.name}
                      onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Hospital Email Address *</label>
                  <div className="input-with-icon">
                    <Mail size={16} className="input-left-icon" />
                    <input
                      type="email"
                      className="form-input with-left-icon"
                      placeholder="e.g. rchen@smartmed.hospital"
                      value={newUserData.email}
                      onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Temporary Initial Password *</label>
                  <div className="input-with-icon">
                    <Lock size={16} className="input-left-icon" />
                    <input
                      type="password"
                      className="form-input with-left-icon"
                      placeholder="At least 6 characters"
                      value={newUserData.password}
                      onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-row-2col">
                  <div className="form-group">
                    <label className="form-label">Assigned Role *</label>
                    <select
                      className="form-select"
                      value={newUserData.role}
                      onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                    >
                      <option value="doctor">Doctor (Clinical Oversight & Booking)</option>
                      <option value="nurse">Nurse (Care & Sanitization Sign-off)</option>
                      <option value="staff">Staff (Biomedical & Relocation)</option>
                      <option value="admin">Administrator (Full Privileges)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Department *</label>
                    <div className="input-with-icon">
                      <Building size={16} className="input-left-icon" />
                      <input
                        type="text"
                        className="form-input with-left-icon"
                        placeholder="e.g. Emergency Medicine"
                        value={newUserData.department}
                        onChange={(e) => setNewUserData({ ...newUserData, department: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => !createSubmitting && setIsCreateOpen(false)}
                  disabled={createSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={createSubmitting}>
                  {createSubmitting ? (
                    <>
                      <RotateCcw size={15} className="animate-spin" />
                      Provisioning Account...
                    </>
                  ) : (
                    <>
                      <UserPlus size={15} />
                      Provision Account
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
