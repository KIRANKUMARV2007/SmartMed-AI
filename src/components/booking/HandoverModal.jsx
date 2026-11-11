import { useState } from 'react';
import { X, CheckCircle2, ShieldCheck, MapPin, UserCheck } from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';
import ReservationCountdown from '../common/ReservationCountdown';

export default function HandoverModal() {
  const {
    handoverTargetEquipment: item,
    setHandoverTargetEquipment,
    confirmHandover,
    cancelReservation,
    activePersona,
  } = useEquipment();

  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!item) return null;

  const handleConfirm = () => {
    setErrorMessage('');
    const res = confirmHandover(item.id);
    if (res.success) {
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setHandoverTargetEquipment(null);
      }, 1200);
    } else {
      setErrorMessage(res.error);
    }
  };

  const handleCancelReservation = () => {
    cancelReservation(item.id, `Released by ${activePersona.name}`);
    setHandoverTargetEquipment(null);
  };

  return (
    <div className="modal-backdrop" onClick={() => setHandoverTargetEquipment(null)}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <ShieldCheck size={20} color="var(--status-ready)" />
            <span>Physical Bedside Handover Verification</span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => setHandoverTargetEquipment(null)}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Equipment & Reservation Details */}
          <div
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>{item.name}</strong>
                <div style={{ fontSize: 11.5, color: 'var(--accent-blue)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {item.id} • {item.serialNumber}
                </div>
              </div>
              <ReservationCountdown expiresAt={item.reservation?.expiresAt} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12.5, color: 'var(--text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={13} color="var(--accent-blue)" />
                {item.currentRoom}
              </span>
              <span>•</span>
              <span>
                Reserved for <strong>{item.reservation?.department}</strong>
              </span>
            </div>
          </div>

          {/* Clinical Handover Requirement Rule */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--accent-blue-light)',
              border: '1px solid rgba(29, 95, 193, 0.2)',
              fontSize: 12.5,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: 'var(--accent-blue)', display: 'block', marginBottom: 4 }}>
              Two-Step Custody Governance:
            </strong>
            Reservation holds equipment from being booked by other wards, but does not indicate physical presence. Clinical staff must verify device serial number and physical condition at bedside to transition status to <strong>In Use</strong>.
          </div>

          {/* Handover Confirmer Profile */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-card)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <UserCheck size={18} color="var(--status-ready)" />
            <div style={{ fontSize: 12.5 }}>
              <div>
                Staff Member Verifying Custody:{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{activePersona.name}</strong>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {activePersona.role} ({activePersona.id}) • {activePersona.department}
              </span>
            </div>
          </div>

          {errorMessage && (
            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--status-faulty-bg)',
                border: '1px solid var(--status-faulty-border)',
                color: 'var(--status-faulty)',
                fontSize: 13,
              }}
            >
              {errorMessage}
            </div>
          )}

          {isSuccess && (
            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--status-ready-bg)',
                border: '1px solid var(--status-ready-border)',
                color: 'var(--status-ready)',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Handover verified! Equipment is now In Use in {item.currentRoom}.
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleCancelReservation}
            style={{ color: 'var(--status-faulty)', borderColor: 'var(--status-faulty-border)', backgroundColor: 'var(--status-faulty-bg)' }}
          >
            Cancel Hold & Release
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleConfirm}
            disabled={isSuccess}
            style={{ background: 'var(--status-ready)', color: '#ffffff', border: 'none' }}
          >
            <CheckCircle2 size={16} />
            Confirm Bedside Handover (In Use)
          </button>
        </div>
      </div>
    </div>
  );
}
