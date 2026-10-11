import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  MapPin,
  AlertTriangle,
  QrCode,
  Sparkles,
  CalendarCheck,
  ShieldCheck,
  RotateCcw,
  Printer,
} from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';
import ReservationCountdown from '../common/ReservationCountdown';

export default function EquipmentDetailModal() {
  const {
    inspectingEquipment: item,
    setInspectingEquipment,
    isLocationStale,
    getRelativeTime,
    clearSanitization,
    setBookingTargetEquipment,
    setHandoverTargetEquipment,
    returnEquipment,
    setQRCardTarget,
  } = useEquipment();

  if (!item) return null;

  const isStale = isLocationStale(item);

  return (
    <div className="modal-backdrop" onClick={() => setInspectingEquipment(null)}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span>{item.name}</span>
            <span className="equip-id-code" style={{ fontSize: 13 }}>
              [{item.id}]
            </span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => setInspectingEquipment(null)}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Stale Location Notice if applicable */}
          {isStale && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                color: '#fbbf24',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontSize: 13,
              }}
            >
              <AlertTriangle size={20} flexShrink={0} />
              <div>
                <strong>Location Verification Overdue (&gt;6 Hours)</strong>
                <div>
                  This device was last scanned in <strong>{item.currentRoom}</strong> {getRelativeTime(item.lastConfirmedAt)}. An authorized staff member must re-scan the room and equipment QR codes to refresh geolocation status.
                </div>
              </div>
            </div>
          )}

          {/* Technical Specs Grid */}
          <div className="spec-grid">
            <div className="spec-item">
              <span className="spec-label">Category</span>
              <span className="spec-value">{item.category}</span>
            </div>

            <div className="spec-item">
              <span className="spec-label">Manufacturer & Model</span>
              <span className="spec-value">{item.model}</span>
            </div>

            <div className="spec-item">
              <span className="spec-label">Serial Number</span>
              <span className="spec-value" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                {item.serialNumber}
              </span>
            </div>

            <div className="spec-item">
              <span className="spec-label">Clinical Status</span>
              <span className="spec-value" style={{ color: item.status === 'Available' ? 'var(--status-ready)' : 'var(--accent-cyan)' }}>
                {item.status}
              </span>
            </div>

            <div className="spec-item">
              <span className="spec-label">Last-Confirmed Room</span>
              <span className="spec-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={15} color="var(--accent-cyan)" />
                {item.currentRoom}
              </span>
            </div>

            <div className="spec-item">
              <span className="spec-label">Verified By</span>
              <span className="spec-value">{item.lastConfirmedBy}</span>
            </div>

            <div className="spec-item">
              <span className="spec-label">Last Physical Scan</span>
              <span className="spec-value" style={{ fontSize: 13 }}>
                {new Date(item.lastConfirmedAt).toLocaleString()} ({getRelativeTime(item.lastConfirmedAt)})
              </span>
            </div>

            <div className="spec-item">
              <span className="spec-label">Battery Readiness</span>
              <span className="spec-value">
                {item.hasBattery ? `${item.batteryLevel}% Charge` : 'Wall AC Powered'}
              </span>
            </div>

            <div className="spec-item">
              <span className="spec-label">Operating Hours</span>
              <span className="spec-value">{item.operatingHours} hrs</span>
            </div>

            <div className="spec-item">
              <span className="spec-label">Next Scheduled Service</span>
              <span className="spec-value">{item.nextMaintenanceDate}</span>
            </div>
          </div>

          {/* Active Reservation Hold Banner */}
          {item.reservation && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#fbbf24' }}>
                  Active Reservation Hold
                </span>
                <ReservationCountdown expiresAt={item.reservation.expiresAt} />
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Reserved for <strong>{item.reservation.department}</strong> by{' '}
                <strong>{item.reservation.reservedBy}</strong> ({item.reservation.staffId}).
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Indication: {item.reservation.purpose}
              </div>
            </div>
          )}

          {/* Real SVG QR Code Token */}
          <div className="qr-preview-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                <QrCode size={16} color="#0284c7" />
                <span>Physical QR Token</span>
              </div>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '4px 8px', fontSize: 11, borderColor: '#cbd5e1', color: '#0f172a' }}
                onClick={() => {
                  setQRCardTarget({ type: 'equipment', data: item });
                  setInspectingEquipment(null);
                }}
              >
                <Printer size={12} style={{ marginRight: 4 }} />
                Open Printable Label
              </button>
            </div>

            <div
              style={{
                padding: 10,
                backgroundColor: '#ffffff',
                border: '2px solid #e2e8f0',
                borderRadius: 'var(--radius-md)',
                marginTop: 6,
              }}
            >
              <QRCodeSVG
                value={`SMARTMED://EQUIPMENT/${item.id}`}
                size={120}
                level="M"
              />
            </div>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#64748b' }}>
              SMARTMED://EQUIPMENT/{item.id}
            </span>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div>
            {item.status === 'Available' && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setBookingTargetEquipment(item);
                  setInspectingEquipment(null);
                }}
              >
                <CalendarCheck size={14} />
                Book Device (30m Hold)
              </button>
            )}

            {item.status === 'Reserved' && (
              <button
                type="button"
                className="btn-primary"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                onClick={() => {
                  setHandoverTargetEquipment(item);
                  setInspectingEquipment(null);
                }}
              >
                <ShieldCheck size={14} />
                Verify Bedside Handover
              </button>
            )}

            {item.status === 'In Use' && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  returnEquipment(item.id);
                  setInspectingEquipment(null);
                }}
              >
                <RotateCcw size={13} style={{ marginRight: 4 }} />
                Return Equipment (Routes to Decon)
              </button>
            )}

            {item.status === 'Sanitization Required' && (
              <button
                type="button"
                className="btn-clear-san"
                style={{ padding: '8px 14px' }}
                onClick={() => {
                  clearSanitization(item.id);
                  setInspectingEquipment(null);
                }}
              >
                <Sparkles size={14} style={{ display: 'inline', marginRight: 6 }} />
                Confirm Sanitization Clearance
              </button>
            )}
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => setInspectingEquipment(null)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
