import {
  Activity,
  HeartPulse,
  Droplets,
  Radio,
  Eye,
  CheckCircle,
  AlertTriangle,
  MapPin,
  Clock,
  Sparkles,
  QrCode,
  CalendarCheck,
  ShieldCheck,
  RotateCcw,
  Edit,
} from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';
import { useAuth } from '../../context/AuthContext';
import ReservationCountdown from '../common/ReservationCountdown';

export default function EquipmentTable() {
  const {
    filteredEquipment,
    equipment,
    isLocationStale,
    getRelativeTime,
    setInspectingEquipment,
    setEditingEquipment,
    clearSanitization,
    resetFilters,
    setQRCardTarget,
    setBookingTargetEquipment,
    setHandoverTargetEquipment,
    returnEquipment,
    dataSource,
    apiSyncStatus,
    apiError,
    refreshEquipment,
    setDataSource,
  } = useEquipment();

  const { isAdmin, isDoctor, isNurse, isStaff } = useAuth();

  // Helper to pick category icon
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
    <div className="table-card">
      <div className="table-card-header">
        <div className="table-card-title">
          <Activity size={18} color="var(--accent-cyan)" />
          <span>Active Medical Equipment Roster</span>
          <span className="table-badge-counter">
            Showing {filteredEquipment.length} items
          </span>
        </div>
        <span className="table-scroll-hint">
          Swipe table ↔
        </span>
      </div>

      <div className="table-wrapper">
        <table className="clinical-table">
          <thead>
            <tr>
              <th>Equipment / Model</th>
              <th>Category</th>
              <th>Last-Confirmed Room</th>
              <th>Location Freshness</th>
              <th>Battery / Readiness</th>
              <th>Clinical Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {apiSyncStatus === 'loading' ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '56px 20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <RotateCcw size={28} className="animate-spin" color="var(--accent-cyan)" />
                    <p style={{ fontWeight: 600, fontSize: 16 }}>Connecting to SmartMed Express Server...</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                      Retrieving live clinical equipment inventory from Express backend
                    </p>
                  </div>
                </td>
              </tr>
            ) : dataSource === 'live' && apiSyncStatus === 'error' ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <AlertTriangle size={36} color="var(--status-faulty)" />
                    <p style={{ fontWeight: 600, fontSize: 16, color: 'var(--status-faulty)' }}>
                      Backend API Connection Failed
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 540 }}>
                      {apiError || 'The SmartMed server on port 5000 is unavailable or returned an error.'}
                    </p>
                    <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={refreshEquipment}
                        style={{ padding: '6px 14px', fontSize: '13px' }}
                      >
                        <RotateCcw size={13} style={{ marginRight: 6 }} />
                        Retry Connection
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setDataSource('mock')}
                        style={{ padding: '6px 14px', fontSize: '13px' }}
                      >
                        Revert to Mock Data
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ) : filteredEquipment.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <AlertTriangle size={32} color="var(--status-reserved)" />
                    <p style={{ fontWeight: 600, fontSize: 16 }}>
                      {dataSource === 'live' && equipment.length === 0
                        ? 'Backend database returned 0 equipment records'
                        : 'No equipment found matching criteria'}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 500 }}>
                      {dataSource === 'live' && equipment.length === 0
                        ? 'The database contains no items yet. Seed the database with sample clinical assets or return to the mock simulation.'
                        : 'Try adjusting your search query, status filters, or stale location toggle.'}
                    </p>
                    {dataSource === 'live' && equipment.length === 0 ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setDataSource('mock')}
                        style={{ marginTop: 8 }}
                      >
                        Switch to Mock Mode
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={resetFilters}
                        style={{ marginTop: 8 }}
                      >
                        Reset All Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredEquipment.map((item) => {
                const stale = isLocationStale(item);
                const statusClass = getStatusClass(item.status);

                return (
                  <tr key={item.id}>
                    {/* Equipment ID & Name */}
                    <td>
                      <div className="equip-name-cell">
                        <div className="equip-title">
                          {getCategoryIcon(item.category)}
                          <span>{item.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="equip-id-code">{item.id}</span>
                          <span className="equip-model">• {item.model}</span>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td>
                      <span className="category-tag">{item.category}</span>
                    </td>

                    {/* Last Confirmed Room */}
                    <td>
                      <div className="location-cell">
                        <span className="room-pill">
                          <MapPin size={14} color="var(--accent-cyan)" />
                          {item.currentRoom}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Verified by {item.lastConfirmedBy}
                        </span>
                      </div>
                    </td>

                    {/* Freshness & Stale Alert */}
                    <td>
                      <div className="location-cell">
                        {stale ? (
                          <span className="stale-warning-tag" title="Location unverified for more than 6 hours">
                            <AlertTriangle size={12} />
                            Stale (&gt;6h unverified)
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--status-ready)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={12} />
                            Freshly Verified
                          </span>
                        )}
                        <span
                          className="last-verified-row"
                          title={`Exact confirmation: ${new Date(item.lastConfirmedAt).toLocaleString()}`}
                        >
                          <Clock size={12} />
                          {getRelativeTime(item.lastConfirmedAt)}
                        </span>
                      </div>
                    </td>

                    {/* Battery Gauge */}
                    <td>
                      {item.hasBattery && item.batteryLevel !== null ? (
                        <div className="battery-wrapper">
                          <div className="battery-bar-track">
                            <div
                              className={`battery-bar-fill ${
                                item.batteryLevel > 70
                                  ? 'high'
                                  : item.batteryLevel > 35
                                  ? 'med'
                                  : 'low'
                              }`}
                              style={{ width: `${item.batteryLevel}%` }}
                            />
                          </div>
                          <span className="battery-text">{item.batteryLevel}%</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Wall AC / Pass</span>
                      )}
                    </td>

                    {/* Clinical Status & Live Countdown */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span className={`status-badge ${statusClass}`}>
                          <span className="status-badge-dot" />
                          {item.status}
                        </span>
                        {item.status === 'Reserved' && item.reservation?.expiresAt && (
                          <ReservationCountdown expiresAt={item.reservation.expiresAt} compact />
                        )}
                        {item.status === 'Reserved' && item.reservation && (
                          <span style={{ fontSize: 10.5, color: 'var(--status-reserved)' }}>
                            For {item.reservation.department}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <div className="action-btn-group" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        {/* QR Code Action */}
                        <button
                          type="button"
                          className="btn-inspect table-action-btn qr-action-btn"
                          onClick={() => setQRCardTarget({ type: 'equipment', data: item })}
                          title="View & Print SVG QR Code label"
                        >
                          <QrCode size={14} />
                        </button>

                        {/* Admin Edit Modal */}
                        {isAdmin && (
                          <button
                            type="button"
                            className="btn-secondary table-action-btn"
                            onClick={() => setEditingEquipment(item)}
                            title="Administrator edit specifications and status"
                          >
                            <Edit size={13} />
                            <span>Edit</span>
                          </button>
                        )}

                        {/* Booking Action (Admin, Doctor, Nurse) */}
                        {item.status === 'Available' && (isAdmin || isDoctor || isNurse) && (
                          <button
                            type="button"
                            className="btn-primary table-action-btn"
                            onClick={() => setBookingTargetEquipment(item)}
                            title="Reserve equipment for 30 minutes"
                          >
                            <CalendarCheck size={14} />
                            <span>Book</span>
                          </button>
                        )}

                        {/* Handover Action (When Reserved) */}
                        {item.status === 'Reserved' && (isAdmin || isDoctor || isNurse) && (
                          <button
                            type="button"
                            className="btn-primary table-action-btn"
                            onClick={() => setHandoverTargetEquipment(item)}
                            title="Verify physical custody and transition to In Use"
                            style={{
                              background: 'var(--status-ready)',
                              color: '#ffffff',
                              border: 'none',
                            }}
                          >
                            <ShieldCheck size={14} />
                            <span>Handover</span>
                          </button>
                        )}

                        {/* Return Action (When In Use) */}
                        {item.status === 'In Use' && (isAdmin || isDoctor || isNurse) && (
                          <button
                            type="button"
                            className="btn-secondary table-action-btn"
                            onClick={() => returnEquipment(item.id)}
                            title="Discharge from clinical use (routes to Sanitization)"
                          >
                            <RotateCcw size={13} />
                            <span>Return</span>
                          </button>
                        )}

                        {/* Sanitization Clearance (Admin, Nurse, Staff) */}
                        {item.status === 'Sanitization Required' && (isAdmin || isNurse || isStaff) && (
                          <button
                            type="button"
                            className="btn-clear-san table-action-btn"
                            onClick={() => clearSanitization(item.id)}
                            title="Decontaminate and mark cleared for clinical reuse"
                          >
                            <Sparkles size={13} />
                            <span>Clear</span>
                          </button>
                        )}

                        {/* Inspect Specs */}
                        <button
                          type="button"
                          className="btn-inspect table-action-btn"
                          onClick={() => setInspectingEquipment(item)}
                          title="View complete technical specs and audit logs"
                        >
                          <Eye size={13} />
                          <span>Inspect</span>
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
  );
}
