import { useState, useMemo } from 'react';
import {
  ArrowRightLeft,
  ArrowRight,
  ShieldCheck,
  Search,
  Filter,
  Clock,
  Sparkles,
  MapPin,
  CheckCircle2,
  X,
  PlusCircle,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';

export default function MovementAuditView() {
  const { movements, equipment, rooms, getRelativeTime } = useEquipment();

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('All');
  const [selectedRoom, setSelectedRoom] = useState('All');
  const [selectedTimeframe, setSelectedTimeframe] = useState('All');

  // Helper to get equipment category from registry
  const getEquipmentCategory = (equipmentId) => {
    const found = equipment.find((e) => e.id === equipmentId);
    return found ? found.category : 'Medical Asset';
  };

  // Classify audit event types into standardized clinical categories
  const classifyEvent = (mov) => {
    const t = (mov.type || '').toLowerCase();
    const isPhysicalMove = mov.fromRoom && mov.toRoom && mov.fromRoom !== mov.toRoom;

    if (t.includes('qr') || t.includes('relocation') || isPhysicalMove) {
      return {
        category: 'Physical Relocation',
        label: 'Dual-QR Verified Relocation',
        isPhysical: true,
        badgeClass: 'ready',
        color: 'var(--status-ready)',
        bg: 'var(--status-ready-bg)',
        border: 'var(--status-ready-border)',
      };
    }
    if (t.includes('handover') || t.includes('in use')) {
      return {
        category: 'Bedside Handover',
        label: 'Bedside Custody Verified (In Use)',
        isPhysical: false,
        badgeClass: 'inuse',
        color: 'var(--status-inuse)',
        bg: 'var(--status-inuse-bg)',
        border: 'var(--status-inuse-border)',
      };
    }
    if (t.includes('sanitization cleared') || t.includes('decon')) {
      return {
        category: 'Sanitization Clearance',
        label: 'Sanitization Cleared (Available)',
        isPhysical: false,
        badgeClass: 'sanitization',
        color: 'var(--status-sanitization)',
        bg: 'var(--status-sanitization-bg)',
        border: 'var(--status-sanitization-border)',
      };
    }
    if (t.includes('discharge') || t.includes('return')) {
      return {
        category: 'Clinical Return',
        label: 'Discharged (Routed to Decon)',
        isPhysical: false,
        badgeClass: 'sanitization',
        color: 'var(--status-sanitization)',
        bg: 'var(--status-sanitization-bg)',
        border: 'var(--status-sanitization-border)',
      };
    }
    if (t.includes('reservation') && !t.includes('cancel')) {
      return {
        category: 'Reservation Hold',
        label: 'Reservation Hold (No Physical Move)',
        isPhysical: false,
        badgeClass: 'reserved',
        color: 'var(--status-reserved)',
        bg: 'var(--status-reserved-bg)',
        border: 'var(--status-reserved-border)',
      };
    }
    if (t.includes('cancel')) {
      return {
        category: 'Reservation Cancelled',
        label: 'Reservation Released',
        isPhysical: false,
        badgeClass: 'faulty',
        color: 'var(--status-faulty)',
        bg: 'var(--status-faulty-bg)',
        border: 'var(--status-faulty-border)',
      };
    }
    if (t.includes('commissioning')) {
      return {
        category: 'Commissioning',
        label: 'Asset Commissioning',
        isPhysical: false,
        badgeClass: 'inuse',
        color: 'var(--accent-blue)',
        bg: 'var(--accent-blue-light)',
        border: 'rgba(29, 95, 193, 0.2)',
      };
    }
    return {
      category: 'General Audit',
      label: mov.type || 'System Audit Record',
      isPhysical: false,
      badgeClass: 'default',
      color: 'var(--text-secondary)',
      bg: 'var(--bg-surface)',
      border: 'var(--border-card)',
    };
  };

  // Filter and sort movements (most recent first)
  const processedMovements = useMemo(() => {
    const now = Date.now();
    const HOUR = 3600 * 1000;
    const DAY = 24 * HOUR;

    return [...movements]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .filter((mov) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match =
            (mov.equipmentName || '').toLowerCase().includes(q) ||
            (mov.equipmentId || '').toLowerCase().includes(q) ||
            (mov.fromRoom || '').toLowerCase().includes(q) ||
            (mov.toRoom || '').toLowerCase().includes(q) ||
            (mov.staffName || '').toLowerCase().includes(q) ||
            (mov.id || '').toLowerCase().includes(q);
          if (!match) return false;
        }

        // Event type filter
        if (selectedEventType !== 'All') {
          const classification = classifyEvent(mov);
          if (classification.category !== selectedEventType) {
            return false;
          }
        }

        // Room filter
        if (selectedRoom !== 'All') {
          if (mov.fromRoom !== selectedRoom && mov.toRoom !== selectedRoom) {
            return false;
          }
        }

        // Timeframe filter
        if (selectedTimeframe !== 'All') {
          const entryTime = new Date(mov.timestamp).getTime();
          const ageMs = now - entryTime;
          if (selectedTimeframe === 'last24h' && ageMs > DAY) return false;
          if (selectedTimeframe === 'last7d' && ageMs > 7 * DAY) return false;
        }

        return true;
      });
  }, [movements, searchQuery, selectedEventType, selectedRoom, selectedTimeframe]);

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedEventType('All');
    setSelectedRoom('All');
    setSelectedTimeframe('All');
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedEventType !== 'All' ||
    selectedRoom !== 'All' ||
    selectedTimeframe !== 'All';

  // Counts summary
  const physicalTransfersCount = movements.filter((m) => m.fromRoom !== m.toRoom).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Audit Trail Context Guidance Banner */}
      <div className="advisory-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <FileText size={24} color="var(--accent-blue)" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ fontSize: 14 }}>Chain-of-Custody & Movement Audit Trail</strong>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Chronological ledger tracking verified room-level equipment transfers, clinical custody handovers, reservations, and terminal decontaminations. Locations represent last-confirmed physical check-ins.
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--accent-blue-light)',
            border: '1px solid rgba(29, 95, 193, 0.2)',
            color: 'var(--accent-blue)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Immutable Append-Only Log
        </span>
      </div>

      {/* Filter Toolbar */}
      <div className="toolbar-container">
        <div className="toolbar-primary-row">
          {/* Search Box */}
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search by equipment ID, model, room, or staff member..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search movement history"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: 12, color: 'var(--text-muted)' }}
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Event Type Filter */}
          <div className="toolbar-select-group">
            <select
              className="filter-select"
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              aria-label="Filter by Event Type"
            >
              <option value="All">All Event Types</option>
              <option value="Physical Relocation">Physical QR Relocations Only</option>
              <option value="Bedside Handover">Bedside Handovers (In Use)</option>
              <option value="Reservation Hold">Reservation Holds</option>
              <option value="Clinical Return">Clinical Returns</option>
              <option value="Sanitization Clearance">Sanitization Clearances</option>
              <option value="Commissioning">Asset Commissioning</option>
            </select>

            {/* Room Filter */}
            <select
              className="filter-select"
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              aria-label="Filter by Room"
            >
              <option value="All">All Rooms / Wards</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>

            {/* Timeframe Filter */}
            <select
              className="filter-select"
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value)}
              aria-label="Filter by Timeframe"
            >
              <option value="All">All Timeframes</option>
              <option value="last24h">Past 24 Hours</option>
              <option value="last7d">Past 7 Days</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                className="btn-secondary"
                onClick={resetAllFilters}
                style={{ padding: '0 12px', height: '42px', fontSize: '12px' }}
                title="Reset all filters"
              >
                <X size={14} style={{ marginRight: 4 }} />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Status Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, paddingTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
            <span>Showing <strong>{processedMovements.length}</strong> of {movements.length} logged entries</span>
            <span>•</span>
            <span style={{ color: 'var(--status-ready)', fontWeight: 600 }}>
              {physicalTransfersCount} physical relocations
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
            <span style={{ color: 'var(--text-muted)' }}>Event Indicators:</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--status-ready)' }}>
              <ArrowRightLeft size={12} /> Physical Move
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--status-inuse)' }}>
              <ShieldCheck size={12} /> Custody Handover
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--status-reserved)' }}>
              <Clock size={12} /> Reservation Hold
            </span>
          </div>
        </div>
      </div>

      {/* Movement Table Card */}
      <div className="table-card">
        <div className="table-card-header">
          <div className="table-card-title">
            <ArrowRightLeft size={18} color="var(--accent-blue)" />
            <span>Hospital Movement & Clinical Custody Ledger</span>
            <span className="table-badge-counter">
              {processedMovements.length} records
            </span>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="clinical-table">
            <thead>
              <tr>
                <th>Audit ID</th>
                <th>Equipment Asset & Type</th>
                <th>Last-Confirmed Source</th>
                <th>Last-Confirmed Destination</th>
                <th>Event Classification</th>
                <th>Authorizing Staff Member</th>
                <th style={{ textAlign: 'right' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {processedMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <AlertTriangle size={32} color="var(--status-reserved)" />
                      <p style={{ fontWeight: 600, fontSize: 16 }}>No audit entries match the current filters</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                        Try clearing search terms or selecting a broader timeframe.
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={resetAllFilters}
                          style={{ marginTop: 6 }}
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                processedMovements.map((mov) => {
                  const ev = classifyEvent(mov);
                  const category = getEquipmentCategory(mov.equipmentId);
                  const isSameRoom = mov.fromRoom === mov.toRoom;

                  return (
                    <tr key={mov.id}>
                      {/* Audit ID */}
                      <td>
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 11.5,
                            color: 'var(--text-muted)',
                            fontWeight: 600,
                          }}
                        >
                          {mov.id}
                        </span>
                      </td>

                      {/* Equipment Name, Category & ID */}
                      <td>
                        <div className="equip-name-cell">
                          <div className="equip-title">
                            <span>{mov.equipmentName}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span className="equip-id-code">{mov.equipmentId}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>• {category}</span>
                          </div>
                        </div>
                      </td>

                      {/* Source Room */}
                      <td>
                        <div className="location-cell">
                          <span style={{ color: 'var(--text-secondary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <MapPin size={12} color="var(--text-muted)" />
                            {mov.fromRoom}
                          </span>
                        </div>
                      </td>

                      {/* Destination Room */}
                      <td>
                        {isSameRoom ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
                              {mov.toRoom}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: '1px 5px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--bg-surface)',
                                color: 'var(--text-muted)',
                              }}
                              title="No room change. Custody or status transition only."
                            >
                              Stationary
                            </span>
                          </div>
                        ) : (
                          <strong
                            style={{
                              color: 'var(--text-primary)',
                              fontSize: 13,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <ArrowRight size={13} color="var(--accent-blue)" />
                            {mov.toRoom}
                          </strong>
                        )}
                      </td>

                      {/* Event Classification Badge */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: ev.bg,
                              border: `1px solid ${ev.border}`,
                              color: ev.color,
                              fontSize: 11.5,
                              fontWeight: 700,
                              width: 'fit-content',
                            }}
                          >
                            {ev.isPhysical ? <ArrowRightLeft size={12} /> : <ShieldCheck size={12} />}
                            {ev.label}
                          </span>
                          {mov.details && (
                            <span
                              style={{
                                fontSize: 11,
                                color: 'var(--text-muted)',
                                maxWidth: 220,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={mov.details}
                            >
                              {mov.details}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Authorizing Staff Member */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {mov.staffName}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {mov.staffRole} ({mov.staffId})
                          </span>
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {getRelativeTime(mov.timestamp)}
                          </span>
                          <span
                            style={{ fontSize: 11, color: 'var(--text-muted)' }}
                            title={new Date(mov.timestamp).toLocaleString()}
                          >
                            {new Date(mov.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
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
    </div>
  );
}
