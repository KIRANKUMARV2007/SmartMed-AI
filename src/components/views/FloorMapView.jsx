import { MapPin, Info, AlertTriangle, QrCode } from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';

export default function FloorMapView() {
  const { rooms, equipment, isLocationStale, setInspectingEquipment, setQRCardTarget } =
    useEquipment();

  // Group rooms by Floor
  const floors = [
    {
      name: 'Floor 1 — Emergency & Trauma Wing',
      rooms: rooms.filter((r) => r.floor === 'Floor 1'),
    },
    {
      name: 'Floor 2 — Intensive Care & Critical Units',
      rooms: rooms.filter((r) => r.floor === 'Floor 2'),
    },
    {
      name: 'Floor 3 — Surgical Theatres & Recovery Wards',
      rooms: rooms.filter((r) => r.floor === 'Floor 3'),
    },
    {
      name: 'Basement 1 — Biomedical Engineering & Central Decon',
      rooms: rooms.filter((r) => r.floor === 'Basement 1'),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Notice Banner */}
      <div className="advisory-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Info size={22} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ fontSize: 14 }}>Modeled Architectural Floorplan Demonstration</strong>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Equipment counts reflect the last confirmed physical dual-scan (room QR code + equipment QR code). Physical movement is not automatically detected.
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(0, 180, 216, 0.15)',
            color: 'var(--accent-cyan)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Phase 3: Interactive Dijkstra Routing
        </span>
      </div>

      {/* Floors Accordion / Grid */}
      {floors.map((floor) => (
        <div key={floor.name} className="panel-card">
          <div className="panel-title-row">
            <div className="panel-title">
              <MapPin size={18} color="var(--accent-cyan)" />
              <span>{floor.name}</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {floor.rooms.length} Clinical Rooms Modeled
            </span>
          </div>

          <div className="floor-rooms-grid">
            {floor.rooms.map((room) => {
              const roomEquip = equipment.filter((e) => e.currentRoom === room.name);

              return (
                <div
                  key={room.id}
                  style={{
                    backgroundColor: 'var(--bg-surface-subtle)',
                    border: '1px solid var(--border-card)',
                    borderRadius: 'var(--radius-md)',
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {room.name}
                      </h3>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {room.department} • {room.wing}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '3px 7px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => setQRCardTarget({ type: 'room', data: room })}
                        title="View printable Room QR placard"
                      >
                        <QrCode size={12} color="var(--accent-cyan)" />
                        QR
                      </button>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: roomEquip.length > 0 ? 'var(--status-ready-bg)' : 'var(--bg-surface)',
                          color: roomEquip.length > 0 ? 'var(--status-ready)' : 'var(--text-muted)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {roomEquip.length} Last-Confirmed
                      </span>
                    </div>
                  </div>

                  {/* Room Equipment Pills */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    {roomEquip.length === 0 ? (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No equipment currently verified at this station.
                      </span>
                    ) : (
                      roomEquip.map((item) => {
                        const stale = isLocationStale(item);
                        return (
                          <div
                            key={item.id}
                            onClick={() => setInspectingEquipment(item)}
                            style={{
                              padding: '8px 10px',
                              backgroundColor: 'var(--bg-card)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: 12,
                              transition: 'all 0.15s ease',
                            }}
                            title="Click to inspect equipment specs"
                          >
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {item.name}
                              </span>
                              <span style={{ fontSize: 10.5, color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono, monospace' }}>
                                {item.id}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {stale && (
                                <span title="Stale location (>6h unverified)">
                                  <AlertTriangle size={13} color="#f59e0b" />
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 600,
                                  padding: '2px 6px',
                                  borderRadius: 'var(--radius-sm)',
                                  backgroundColor:
                                    item.status === 'Available'
                                      ? 'var(--status-ready-bg)'
                                      : item.status === 'Reserved'
                                      ? 'var(--status-reserved-bg)'
                                      : 'var(--status-inuse-bg)',
                                  color:
                                    item.status === 'Available'
                                      ? 'var(--status-ready)'
                                      : item.status === 'Reserved'
                                      ? 'var(--status-reserved)'
                                      : 'var(--status-inuse)',
                                }}
                              >
                                {item.status}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
