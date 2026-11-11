import { useState } from 'react';
import {
  Shield,
  Activity,
  Users,
  Wrench,
  Plus,
  RefreshCw,
  FileText,
  AlertTriangle,
  Trash2,
  Edit,
  Eye,
  CheckCircle,
  Clock,
  MapPin,
  HeartPulse,
  Radio,
  Droplets,
  Layers,
} from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';
import { useAuth } from '../../context/AuthContext';
import FilterToolbar from '../dashboard/FilterToolbar';
import FloorMapPreview from '../dashboard/FloorMapPreview';
import RecentMovements from '../dashboard/RecentMovements';
import MaintenanceAlerts from '../dashboard/MaintenanceAlerts';

export default function AdminDashboard() {
  const {
    stats,
    filteredEquipment,
    refreshEquipment,
    apiSyncStatus,
    setIsRegisterOpen,
    setInspectingEquipment,
    setEditingEquipment,
    deleteEquipment,
    isLocationStale,
    getRelativeTime,
    setActiveTab,
  } = useEquipment();

  const { user } = useAuth();
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteEquipment = async (id) => {
    try {
      setIsDeleting(true);
      setDeleteError('');
      const res = await deleteEquipment(id);
      if (res && res.success === false) {
        setDeleteError(res.error || 'Failed to delete equipment.');
        return;
      }
      setDeleteConfirmId(null);
    } catch (err) {
      setDeleteError(err?.message || 'Error executing decommissioning.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Ventilator':
        return <Activity size={16} color="var(--status-inuse)" />;
      case 'Defibrillator':
        return <HeartPulse size={16} color="var(--status-faulty)" />;
      case 'Infusion Pump':
        return <Droplets size={16} color="var(--status-inuse)" />;
      case 'Portable Ultrasound':
        return <Radio size={16} color="var(--status-sanitization)" />;
      case 'ECG Machine':
        return <HeartPulse size={16} color="var(--status-ready)" />;
      case 'Patient Monitor':
        return <Activity size={16} color="var(--accent-cyan)" />;
      default:
        return <Activity size={16} color="var(--text-muted)" />;
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Available':
        return 'available';
      case 'Reserved':
        return 'reserved';
      case 'In Use':
        return 'inuse';
      case 'Sanitization Required':
        return 'sanitization';
      case 'Under Maintenance':
        return 'maintenance';
      case 'Faulty':
        return 'faulty';
      default:
        return '';
    }
  };

  return (
    <div className="dashboard-view-wrapper">
      {/* Admin Executive Header Banner */}
      <div className="admin-executive-banner">
        <div className="admin-banner-meta">
          <div className="admin-banner-badge-row">
            <span className="admin-pill-badge">
              <Shield size={12} />
              ADMINISTRATIVE CONTROL PANEL
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Session: <strong>{user?.name}</strong> • {user?.department}
            </span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '2px 0 0', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Hospital Asset Governance & System Oversight
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            Full administrative authority over equipment inventory, personnel accounts, and regulatory audit records.
          </p>
        </div>

        <div className="admin-banner-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => setIsRegisterOpen(true)}
            style={{ padding: '8px 16px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} />
            <span>Register Asset</span>
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setActiveTab('users')}
            style={{ padding: '8px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Users size={16} />
            <span>Manage Users</span>
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setActiveTab('audit')}
            style={{ padding: '8px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <FileText size={16} />
            <span>Audit Trail</span>
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={refreshEquipment}
            title="Refresh database sync"
            style={{ padding: '8px 12px' }}
          >
            <RefreshCw size={15} className={apiSyncStatus === 'loading' ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="admin-kpi-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Tracked Assets</span>
            <div className="metric-icon-box total">
              <Activity size={18} />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value">{stats.total}</span>
            <span className="metric-subtitle">units</span>
          </div>
          <div className="metric-footer-note">
            <span className="metric-badge positive">{stats.readyRate}% Operational</span>
            <span>Verified in Atlas</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Available & Ready</span>
            <div className="metric-icon-box ready">
              <CheckCircle size={18} />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value">{stats.available}</span>
            <span className="metric-subtitle">units</span>
          </div>
          <div className="metric-footer-note">
            <span>Immediate dispatch clearance</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Active Clinical Care</span>
            <div className="metric-icon-box inuse">
              <Layers size={18} />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value">{stats.inUse + stats.reserved}</span>
            <span className="metric-subtitle">units</span>
          </div>
          <div className="metric-footer-note">
            <span>{stats.reserved} hold • {stats.inUse} bedside in use</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Maintenance & Quarantine</span>
            <div className="metric-icon-box faulty">
              <Wrench size={18} />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value">{stats.maintenance + stats.faulty + stats.sanitization}</span>
            <span className="metric-subtitle">units</span>
          </div>
          <div className="metric-footer-note">
            <span className="metric-badge warning">
              {stats.maintenance + stats.faulty} BioMed • {stats.sanitization} Decon
            </span>
          </div>
        </div>
      </div>

      {/* Deletion Error Feedback */}
      {deleteError && (
        <div className="login-error-alert" style={{ marginBottom: 16 }}>
          <AlertTriangle size={16} />
          <span>{deleteError}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <FilterToolbar />

      {/* Administrative Equipment Roster Table */}
      <div className="table-card">
        <div className="table-card-header">
          <div className="table-card-title">
            <Shield size={18} color="var(--accent-cyan)" />
            <span>Administrative Equipment Ledger</span>
            <span className="table-badge-counter">Showing {filteredEquipment.length} assets</span>
          </div>
          <span className="table-scroll-hint">Swipe table ↔</span>
        </div>

        <div className="table-wrapper">
          <table className="clinical-table" style={{ minWidth: 880 }}>
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Asset / Specifications</th>
                <th style={{ width: '13%' }}>Category</th>
                <th style={{ width: '14%' }}>Assigned Room</th>
                <th style={{ width: '11%' }}>Condition</th>
                <th style={{ width: '13%' }}>Clinical Status</th>
                <th style={{ width: '12%' }}>Last Audit</th>
                <th style={{ width: '12%', textAlign: 'right' }}>Admin Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEquipment.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <AlertTriangle size={32} color="var(--status-reserved)" style={{ margin: '0 auto 8px' }} />
                    <p style={{ fontWeight: 600 }}>No equipment matches search filters.</p>
                  </td>
                </tr>
              ) : (
                filteredEquipment.map((item) => {
                  const stale = isLocationStale(item);
                  const statusClass = getStatusClass(item.status);
                  const isConfirmingDelete = deleteConfirmId === item.id;

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="equip-name-cell">
                          <div className="equip-title">
                            {getCategoryIcon(item.category)}
                            <span>{item.name}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="equip-id-code">{item.id}</span>
                            <span className="equip-model">• {item.model}</span>
                            {item.serialNumber && (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                ({item.serialNumber})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="category-tag">{item.category}</span>
                      </td>

                      <td>
                        <div className="location-cell">
                          <span className="room-pill">
                            <MapPin size={14} color="var(--accent-cyan)" />
                            {item.currentRoom}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span style={{ fontSize: 12.5, fontWeight: 500 }}>
                          {item.condition || 'Optimal'}
                        </span>
                        {item.hasBattery && item.batteryLevel !== null && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            Battery: {item.batteryLevel}%
                          </div>
                        )}
                      </td>

                      <td>
                        <span className={`status-badge ${statusClass}`}>
                          <span className="status-badge-dot" />
                          {item.status}
                        </span>
                      </td>

                      <td>
                        <div className="location-cell">
                          <span className={`last-verified-row ${stale ? 'stale-warning' : ''}`}>
                            <Clock size={12} />
                            {getRelativeTime(item.lastConfirmedAt)}
                          </span>
                          <span style={{ fontSize: 11, color: stale ? 'var(--status-faulty)' : 'var(--text-muted)' }}>
                            {stale ? '⚠️ Stale: ' : 'by '}
                            {item.lastConfirmedBy || 'System'}
                          </span>
                        </div>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        {isConfirmingDelete ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: 11, color: 'var(--status-faulty)', fontWeight: 600 }}>
                              Confirm Decommission?
                            </span>
                            <button
                              type="button"
                              className="btn-primary"
                              style={{ background: 'var(--status-faulty)', borderColor: 'var(--status-faulty)', padding: '3px 8px', fontSize: 11 }}
                              onClick={() => handleDeleteEquipment(item.id)}
                              disabled={isDeleting}
                            >
                              Yes, Delete
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '3px 8px', fontSize: 11 }}
                              onClick={() => setDeleteConfirmId(null)}
                              disabled={isDeleting}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="action-btn-group" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                            {/* Inspect Specs */}
                            <button
                              type="button"
                              className="btn-inspect table-action-btn"
                              onClick={() => setInspectingEquipment(item)}
                              title="Inspect equipment technical profile"
                            >
                              <Eye size={13} />
                              <span>Inspect</span>
                            </button>

                            {/* Admin Edit Modal */}
                            <button
                              type="button"
                              className="btn-secondary table-action-btn"
                              onClick={() => setEditingEquipment(item)}
                              title="Administrator edit specifications and status"
                            >
                              <Edit size={13} />
                              <span>Edit</span>
                            </button>

                            {/* Safe Decommission / Delete */}
                            <button
                              type="button"
                              className="btn-secondary table-action-btn"
                              onClick={() => setDeleteConfirmId(item.id)}
                              style={{ color: 'var(--status-faulty)' }}
                              title="Decommission asset from MongoDB"
                              disabled={item.status === 'In Use'}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lower Dashboard Grid */}
      <div className="dashboard-lower-grid">
        <RecentMovements />
        <MaintenanceAlerts />
        <FloorMapPreview />
      </div>
    </div>
  );
}
