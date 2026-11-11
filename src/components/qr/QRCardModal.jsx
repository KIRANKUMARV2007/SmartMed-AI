import { QRCodeSVG } from 'qrcode.react';
import { X, Printer, MapPin, Activity, QrCode } from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';

export default function QRCardModal() {
  const { qrCardTarget, setQRCardTarget } = useEquipment();

  if (!qrCardTarget) return null;

  const isEquip = qrCardTarget.type === 'equipment';
  const data = qrCardTarget.data;
  const qrPayload = isEquip
    ? `SMARTMED://EQUIPMENT/${data.id}`
    : `SMARTMED://ROOM/${data.id}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-backdrop" onClick={() => setQRCardTarget(null)}>
      <div
        className="modal-dialog"
        style={{ maxWidth: 460 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">
            <QrCode size={18} color="var(--accent-blue)" />
            <span>{isEquip ? 'Equipment QR Tag' : 'Room Location Placard'}</span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => setQRCardTarget(null)}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ alignItems: 'center', textAlign: 'center', gap: 16 }}>
          {/* Printable Card Area */}
          <div
            id="printable-qr-card"
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              border: '1px solid var(--border-card)',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-blue)' }}>
              <Activity size={18} />
              <strong style={{ fontSize: 13, letterSpacing: 0.5 }}>SMARTMED AI CLINICAL ASSET</strong>
            </div>

            {/* Real SVG QR Code from qrcode.react */}
            <div
              style={{
                padding: 12,
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-card)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <QRCodeSVG
                value={qrPayload}
                size={180}
                level="H"
                includeMargin={false}
              />
            </div>

            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>
              {data.id}
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
              {data.name}
            </div>

            {isEquip ? (
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                SN: {data.serialNumber} • Model: {data.model}
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--accent-blue)', fontWeight: 600 }}>
                  <MapPin size={12} /> Last-Confirmed: {data.currentRoom}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                {data.department} • {data.floor} ({data.wing})
              </div>
            )}

            <div
              style={{
                fontSize: 9.5,
                color: 'var(--text-muted)',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: 8,
                width: '100%',
              }}
            >
              Scan with SmartMed Scanner to confirm location update or book device.
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)', wordBreak: 'break-all', maxWidth: '100%' }}>
            Payload: <code style={{ fontSize: 11, wordBreak: 'break-all' }}>{qrPayload}</code>
          </span>
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setQRCardTarget(null)}
            >
              Close
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handlePrint}
            >
              <Printer size={15} />
              Print Label
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
