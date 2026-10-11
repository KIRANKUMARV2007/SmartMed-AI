import { useState } from 'react';
import {
  X,
  Clock,
  CalendarCheck,
  UserCheck,
  MapPin,
  ShieldAlert,
} from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';

export default function BookingModal() {
  const {
    bookingTargetEquipment: item,
    setBookingTargetEquipment,
    bookEquipment,
    activePersona,
  } = useEquipment();

  const [purpose, setPurpose] = useState('Emergency Clinical Procedure');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!item) return null;

  const handleBook = (e) => {
    e.preventDefault();
    setErrorMessage('');

    const res = bookEquipment(item.id, { purpose });
    if (res.success) {
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setBookingTargetEquipment(null);
      }, 1400);
    } else {
      setErrorMessage(res.error);
    }
  };

  const isBlocked =
    item.status === 'Reserved' ||
    item.status === 'In Use' ||
    item.status === 'Faulty' ||
    item.status === 'Under Maintenance' ||
    item.status === 'Sanitization Required';

  return (
    <div className="modal-backdrop" onClick={() => setBookingTargetEquipment(null)}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <CalendarCheck size={20} color="var(--accent-cyan)" />
            <span>Equipment Reservation Hold</span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => setBookingTargetEquipment(null)}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleBook}>
          <div className="modal-body">
            {/* Equipment Summary Header */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                  {item.name}
                </strong>
                <div style={{ fontSize: 11.5, color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {item.id} • {item.model}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={12} color="var(--accent-cyan)" />
                  {item.currentRoom}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: item.status === 'Available' ? 'var(--status-ready)' : '#f59e0b',
                  }}
                >
                  Status: {item.status}
                </span>
              </div>
            </div>

            {/* Error Message Banner */}
            {errorMessage && (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '2px solid rgba(239, 68, 68, 0.5)',
                  color: '#f87171',
                  fontSize: 13.5,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <ShieldAlert size={22} flexShrink={0} color="#ef4444" />
                <div>
                  <strong style={{ display: 'block', fontSize: 14, marginBottom: 2 }}>
                    Reservation Blocked:
                  </strong>
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            {/* Success Message Banner */}
            {isSuccess && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.5)',
                  color: 'var(--status-ready)',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Reservation confirmed! 30-minute hold initiated for {activePersona.department}.
              </div>
            )}

            {/* Staff Identity Anchor Notice */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(0, 180, 216, 0.08)',
                border: '1px solid rgba(0, 180, 216, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 12.5,
              }}
            >
              <UserCheck size={18} color="var(--accent-cyan)" flexShrink={0} />
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Booking Staff Identity:</span>{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {activePersona.name} ({activePersona.role})
                </strong>
                <div style={{ fontSize: 11, color: 'var(--accent-cyan)' }}>
                  Department: {activePersona.department} • Staff ID: {activePersona.id}
                </div>
              </div>
            </div>

            {/* Reservation Window Notice */}
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 12,
                color: '#fbbf24',
              }}
            >
              <Clock size={16} flexShrink={0} />
              <span>
                <strong>30-Minute Governance Policy:</strong> Reservations automatically release to Available if physical bedside handover is not confirmed within 30 minutes.
              </span>
            </div>

            {/* Clinical Purpose Input */}
            <div className="form-group">
              <label className="form-label">Clinical Indication / Procedure Purpose *</label>
              <select
                className="form-select"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                disabled={isBlocked}
              >
                <option value="Emergency Clinical Procedure">Emergency Clinical Procedure</option>
                <option value="Acute Trauma Resuscitation">Acute Trauma Resuscitation</option>
                <option value="Operating Theatre Support (Scheduled)">Operating Theatre Support (Scheduled)</option>
                <option value="ICU Bedside Escalation">ICU Bedside Escalation</option>
                <option value="Urgent Patient Ward Transfer">Urgent Patient Ward Transfer</option>
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setBookingTargetEquipment(null)}
            >
              Close
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isBlocked || isSuccess}
              style={{
                opacity: isBlocked ? 0.4 : 1,
                cursor: isBlocked ? 'not-allowed' : 'pointer',
              }}
            >
              <CalendarCheck size={16} />
              Confirm 30-Min Reservation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
