import { useState, useEffect } from 'react';
import { MapPin, Info, AlertTriangle, QrCode, Navigation } from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';
import { equipmentApi } from '../../api';

export default function FloorMapView() {
  const { rooms, equipment, isLocationStale, setInspectingEquipment, setQRCardTarget } =
    useEquipment();

  // Navigation Route Planner State
  const [navFrom, setNavFrom] = useState('');
  const [navTo, setNavTo] = useState('');
  const [activeRoute, setActiveRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(null);

  // Initialize default room selection once rooms are loaded
  useEffect(() => {
    if (rooms.length >= 2 && !navFrom && !navTo) {
      setNavFrom(rooms[0].name);
      setNavTo(rooms[2].name);
    }
  }, [rooms, navFrom, navTo]);

  const handleComputeRoute = async () => {
    if (!navFrom || !navTo) return;
    setRouteLoading(true);
    setRouteError(null);
    try {
      const res = await equipmentApi.getNavigationRoute(navFrom, navTo);
      if (res.success && res.route) {
        setActiveRoute(res.route);
      } else {
        setRouteError(res.error || 'Could not find a valid route between rooms.');
      }
    } catch (err) {
      setRouteError(err.message || 'Route calculation failed.');
      setActiveRoute(null);
    } finally {
      setRouteLoading(false);
    }
  };

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
            <strong style={{ fontSize: 14 }}>Modeled Architectural Floorplan & Indoor Navigation</strong>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Equipment counts reflect the last confirmed physical dual-scan (room QR code + equipment QR code). Route distances and transit times are architectural Dijkstra estimates, never live tracking.
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
          Dijkstra Graph Routing Active
        </span>
      </div>

      {/* Interactive Hospital Route Planner Panel */}
      <div className="panel-card">
        <div className="panel-title-row">
          <div className="panel-title">
            <Navigation size={18} color="var(--accent-cyan)" />
            <span>Hospital Indoor Route Planner & Distance Intelligence</span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Calculates shortest corridor & vertical elevator path
          </span>
        </div>

        <div className="route-planner-grid">
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700 }}>
              Starting Room / Unit:
            </label>
            <select
              className="form-select"
              value={navFrom}
              onChange={(e) => setNavFrom(e.target.value)}
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name} ({r.floor})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700 }}>
              Destination Room / Unit:
            </label>
            <select
              className="form-select"
              value={navTo}
              onChange={(e) => setNavTo(e.target.value)}
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name} ({r.floor})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 1 }}>
            <button
              type="button"
              className="btn-primary"
              style={{ width: '100%', height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onClick={handleComputeRoute}
              disabled={routeLoading || !navFrom || !navTo}
            >
              <Navigation size={15} />
              <span>{routeLoading ? 'Calculating Path...' : 'Calculate Shortest Route'}</span>
            </button>
          </div>
        </div>

        {/* Route Error */}
        {routeError && (
          <div
            style={{
              marginTop: 14,
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--status-faulty-bg)',
              color: 'var(--status-faulty)',
              fontSize: 12.5,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertTriangle size={16} />
            <span>{routeError}</span>
          </div>
        )}

        {/* Calculated Route Results */}
        {activeRoute && (
          <div
            style={{
              marginTop: 16,
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface-subtle, rgba(255,255,255,0.02))',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                  Shortest Route: {activeRoute.fromRoom} → {activeRoute.toRoom}
                </strong>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="phase-tag" style={{ fontSize: 11, background: 'rgba(34, 197, 94, 0.15)', color: 'var(--status-ready)' }}>
                  Total Distance: {activeRoute.totalDistanceMeters}m
                </span>
                <span className="phase-tag" style={{ fontSize: 11, background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-cyan)' }}>
                  Est. Transit: ~{activeRoute.estimatedTransitMinutes} mins
                </span>
                {activeRoute.floorChanges > 0 ? (
                  <span className="phase-tag" style={{ fontSize: 11, background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                    {activeRoute.floorChanges} Floor Change via {activeRoute.elevatorUsed || 'Central Bed Elevator'}
                  </span>
                ) : (
                  <span className="phase-tag" style={{ fontSize: 11 }}>
                    Same Floor
                  </span>
                )}
              </div>
            </div>

            {/* Steps Timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activeRoute.steps.map((step) => (
                <div
                  key={step.index}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: step.isElevator ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-card)',
                    borderLeft: `3px solid ${step.isElevator ? 'var(--accent-blue)' : 'var(--border-subtle)'}`,
                    fontSize: 12,
                    color: 'var(--text-primary)',
                  }}
                >
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: step.isElevator ? 'var(--accent-blue)' : 'var(--text-muted)', minWidth: 16 }}>
                    {step.index}.
                  </span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500 }}>{step.instruction}</span>
                    <div style={{ display: 'flex', gap: 8, fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                      <span>{step.floor}</span>
                      {step.distanceMeters > 0 && <span>• {step.distanceMeters}m</span>}
                      {step.transitTimeSeconds > 0 && <span>• ~{step.transitTimeSeconds}s</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                backgroundColor: 'rgba(255,255,255,0.02)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Info size={13} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
              <span>
                <strong>Architectural Routing Disclaimer: </strong>
                {activeRoute.disclaimer || 'Estimated route and transit times are architectural floor-plan approximations. Never represents real-time physical or RTLS tracking.'}
              </span>
            </div>
          </div>
        )}
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
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0, flex: '1 1 140px' }}>
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
