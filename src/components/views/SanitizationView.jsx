import { useState, useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  MapPin,
  Eye,
  ShieldAlert,
} from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';
import BiomedicalClearancePanel from '../equipment/BiomedicalClearancePanel';

export default function SanitizationView() {
  const {
    equipment,
    clearSanitization,
    setInspectingEquipment,
    getRelativeTime,
    activePersona,
  } = useEquipment();

  // Filter tab for Decon pipeline: 'awaiting' | 'cleared' | 'all'
  const [activeFilter, setActiveFilter] = useState('awaiting');

  // Selected item for focused clearance review
  const [selectedSanId, setSelectedSanId] = useState(null);

  // Items awaiting sanitization (Status = 'Sanitization Required')
  const awaitingItems = equipment.filter((e) => e.status === 'Sanitization Required');

  // Items cleared for clinical use (Status = 'Available' and sanitizationStatus = 'CLEARED')
  const clearedItems = equipment.filter(
    (e) => e.status === 'Available' && e.sanitizationStatus === 'CLEARED'
  );

  // All pipeline items
  const displayItems =
    activeFilter === 'awaiting'
      ? awaitingItems
      : activeFilter === 'cleared'
      ? clearedItems
      : equipment.filter(
          (e) => e.status === 'Sanitization Required' || e.sanitizationStatus === 'CLEARED'
        );

  const selectedSanItem = useMemo(() => {
    if (selectedSanId) {
      const found = equipment.find((e) => e.id === selectedSanId);
      if (found) return found;
    }
    return awaitingItems[0] || clearedItems[0] || null;
  }, [selectedSanId, equipment, awaitingItems, clearedItems]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Infection Control Advisory Banner */}
      <div className="advisory-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Sparkles size={24} color="var(--status-sanitization)" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ fontSize: 14 }}>Infection Control & Decontamination Protocol</strong>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Hospital clinical policy requires all returned equipment to undergo certified terminal disinfection before reuse. Equipment in decontamination is strictly locked from bedside allocation.
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--status-sanitization-bg)',
            border: '1px solid var(--status-sanitization-border)',
            color: 'var(--status-sanitization)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          ISO 13485 Hygiene Standard
        </span>
      </div>

      {/* KPI Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Awaiting Sanitization</span>
            <div
              className="metric-icon-box"
              style={{
                background: 'var(--status-sanitization-bg)',
                color: 'var(--status-sanitization)',
              }}
            >
              <Sparkles size={18} />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value" style={{ color: 'var(--status-sanitization)' }}>
              {awaitingItems.length}
            </span>
            <span className="metric-subtitle">pending clearance</span>
          </div>
          <div className="metric-footer-note">
            <span>Locked from clinical and emergency booking</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Cleared for Clinical Use</span>
            <div
              className="metric-icon-box"
              style={{
                background: 'var(--status-ready-bg)',
                color: 'var(--status-ready)',
              }}
            >
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value" style={{ color: 'var(--status-ready)' }}>
              {clearedItems.length}
            </span>
            <span className="metric-subtitle">ready in inventory</span>
          </div>
          <div className="metric-footer-note">
            <span>Terminal disinfection verified</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Quarantine Lockouts</span>
            <div
              className="metric-icon-box"
              style={{
                background: awaitingItems.length > 0 ? 'var(--status-faulty-bg)' : 'var(--status-ready-bg)',
                color: awaitingItems.length > 0 ? 'var(--status-faulty)' : 'var(--status-ready)',
              }}
            >
              <ShieldAlert size={18} />
            </div>
          </div>
          <div className="metric-value-row">
            <span
              className="metric-value"
              style={{ color: awaitingItems.length > 0 ? 'var(--status-faulty)' : 'var(--status-ready)' }}
            >
              {awaitingItems.length}
            </span>
            <span className="metric-subtitle">units locked</span>
          </div>
          <div className="metric-footer-note">
            <span>{awaitingItems.length > 0 ? 'Restricted from clinical dispatch' : 'Zero active quarantine blocks'}</span>
          </div>
        </div>
      </div>

      {/* Sanitization Queue Table Card */}
      <div className="table-card">
        <div className="table-card-header">
          <div className="table-card-title">
            <Sparkles size={18} color="var(--status-sanitization)" />
            <span>Decontamination & Sanitization Registry</span>
            <span className="table-badge-counter">
              {displayItems.length} items
            </span>
          </div>

          {/* Sub-Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className={`status-pill ${activeFilter === 'awaiting' ? 'active' : ''}`}
              onClick={() => setActiveFilter('awaiting')}
            >
              Awaiting Decon ({awaitingItems.length})
            </button>
            <button
              type="button"
              className={`status-pill ${activeFilter === 'cleared' ? 'active' : ''}`}
              onClick={() => setActiveFilter('cleared')}
            >
              Cleared ({clearedItems.length})
            </button>
            <button
              type="button"
              className={`status-pill ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All Decon Pipeline
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="clinical-table" style={{ minWidth: 860 }}>
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Equipment ID & Model</th>
                <th style={{ width: '12%' }}>Category</th>
                <th style={{ width: '16%' }}>Last-Confirmed Location</th>
                <th style={{ width: '14%' }}>Return / Last Verified</th>
                <th style={{ width: '18%' }}>Sanitization Status</th>
                <th style={{ width: '18%' }}>Decontamination Protocol</th>
                <th style={{ width: '14%', textAlign: 'right' }}>Staff Action</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <CheckCircle2 size={32} color="var(--status-ready)" />
                      <p style={{ fontWeight: 600, fontSize: 16 }}>
                        {activeFilter === 'awaiting'
                          ? 'No equipment awaiting sanitization'
                          : 'No items in this filter view'}
                      </p>
                      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                        All returned clinical assets have been verified and decontaminated.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayItems.map((item) => {
                  const isAwaiting = item.status === 'Sanitization Required';
                  const isSelected = item.id === selectedSanItem?.id;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedSanId(item.id)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'var(--accent-blue-light, rgba(29, 95, 193, 0.06))' : undefined,
                      }}
                      title="Click to review clearance details"
                    >
                      {/* Equipment ID & Name */}
                      <td>
                        <div className="equip-name-cell">
                          <div className="equip-title">
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

                      {/* Last Known Room */}
                      <td>
                        <div className="location-cell">
                          <span className="room-pill">
                            <MapPin size={14} color="var(--accent-blue)" />
                            {item.currentRoom}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Verified by {item.lastConfirmedBy}
                          </span>
                        </div>
                      </td>

                      {/* Return / Verified Time */}
                      <td>
                        <div className="location-cell">
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {getRelativeTime(item.lastConfirmedAt)}
                          </span>
                          <span
                            className="last-verified-row"
                            title={new Date(item.lastConfirmedAt).toLocaleString()}
                          >
                            <Clock size={11} />
                            {new Date(item.lastConfirmedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        {isAwaiting ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span className="status-badge sanitization">
                              <span className="status-badge-dot" />
                              Sanitization Required
                            </span>
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                color: 'var(--status-faulty)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                            >
                              <ShieldAlert size={11} />
                              Locked from Emergency Booking
                            </span>
                          </div>
                        ) : (
                          <span className="status-badge available">
                            <span className="status-badge-dot" />
                            Cleared & Available
                          </span>
                        )}
                      </td>

                      {/* Notes / Protocol */}
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {item.notes || 'Terminal chemical wipe & UV-C pass'}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-btn-group" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                          {isAwaiting ? (
                            <button
                              type="button"
                              className="btn-clear-san table-action-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                clearSanitization(item.id);
                              }}
                              title={`Sign off disinfection as ${activePersona.name} (${activePersona.role})`}
                            >
                              <Sparkles size={13} />
                              <span>Clear Decon</span>
                            </button>
                          ) : (
                            <span
                              style={{
                                fontSize: 11.5,
                                color: 'var(--status-ready)',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                paddingRight: 8,
                              }}
                            >
                              <CheckCircle2 size={13} />
                              Verified
                            </span>
                          )}

                          <button
                            type="button"
                            className="btn-inspect table-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectingEquipment(item);
                            }}
                            title="View complete specs and audit log"
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

      {/* Biomedical Clearance & Equipment Release Panel */}
      <BiomedicalClearancePanel
        selectedItem={selectedSanItem}
        itemsList={awaitingItems.length > 0 ? awaitingItems : displayItems}
        onSelectItem={(item) => setSelectedSanId(item.id)}
        onClear={(item) => clearSanitization(item.id)}
        canClear={selectedSanItem ? selectedSanItem.status === 'Sanitization Required' : false}
        contextType="sanitization"
        title="Biomedical Clearance"
        subtitle="Equipment safety verification and release approval"
      />
    </div>
  );
}
