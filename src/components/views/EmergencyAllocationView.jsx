import { useState, useMemo } from 'react';
import {
  Siren,
  ShieldCheck,
  ShieldAlert,
  MapPin,
  Clock,
  Battery,
  BatteryCharging,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Filter,
  Eye,
  CalendarCheck,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';

export default function EmergencyAllocationView() {
  const {
    equipment,
    rooms,
    activePersona,
    bookEquipment,
    setBookingTargetEquipment,
    setInspectingEquipment,
    isLocationStale,
    getRelativeTime,
    staleThresholdHours,
  } = useEquipment();

  // Emergency selection parameters
  const [selectedCategory, setSelectedCategory] = useState('Ventilator');
  const [targetRoomName, setTargetRoomName] = useState(
    rooms.find((r) => r.type === 'Emergency')?.name || rooms[0]?.name || 'ER-101 (Trauma Bay 1)'
  );
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [showIneligibleAudit, setShowIneligibleAudit] = useState(false);

  // Available categories for emergency selection
  const emergencyCategories = [
    'Ventilator',
    'Defibrillator',
    'Infusion Pump',
    'Patient Monitor',
    'Portable Ultrasound',
    'ECG Machine',
    'Transport Wheelchair',
    'All Categories',
  ];

  // Target Room object
  const targetRoom = useMemo(() => {
    return rooms.find((r) => r.name === targetRoomName) || rooms[0];
  }, [rooms, targetRoomName]);

  // Modeled transit distance calculation based on architectural floor/wing proximity
  const calculateModeledProximity = (equipmentRoomName, destRoom) => {
    if (!destRoom) {
      return {
        minutes: null,
        label: 'Proximity unknown',
        basis: 'Destination room not specified',
        distanceTier: 'unknown',
      };
    }

    if (equipmentRoomName === destRoom.name) {
      return {
        minutes: 0,
        label: 'Immediate Bedside (Same Room)',
        basis: 'Same room location confirmed',
        distanceTier: 'immediate',
      };
    }

    const equipRoom = rooms.find((r) => r.name === equipmentRoomName);
    if (!equipRoom) {
      return {
        minutes: null,
        label: 'Unmodeled room route',
        basis: 'Room metadata unavailable in registry',
        distanceTier: 'unknown',
      };
    }

    // Same floor comparison
    if (equipRoom.floor === destRoom.floor) {
      if (equipRoom.wing === destRoom.wing) {
        return {
          minutes: 1,
          label: `~1 min (${destRoom.floor}, ${destRoom.wing})`,
          basis: 'Same floor and corridor wing',
          distanceTier: 'close',
        };
      } else {
        return {
          minutes: 2.5,
          label: `~2-3 min (${destRoom.floor})`,
          basis: 'Same floor, cross-wing transit',
          distanceTier: 'medium',
        };
      }
    }

    // Different floor (vertical elevator transit required)
    const floorMap = { 'Basement 1': 0, 'Floor 1': 1, 'Floor 2': 2, 'Floor 3': 3 };
    const diff = Math.abs((floorMap[equipRoom.floor] || 1) - (floorMap[destRoom.floor] || 1));
    const estimatedMinutes = Math.min(6, 2 + diff * 1.5);

    return {
      minutes: estimatedMinutes,
      label: `~${estimatedMinutes} min (${equipRoom.floor} → ${destRoom.floor})`,
      basis: 'Multi-floor vertical transit (elevator required)',
      distanceTier: 'distant',
    };
  };

  // Filter matching equipment
  const matchingCategoryEquipment = useMemo(() => {
    if (selectedCategory === 'All Categories') return equipment;
    return equipment.filter((e) => e.category === selectedCategory);
  }, [equipment, selectedCategory]);

  // Safety Eligibility Enforcement:
  // Strict rule: Exclude Reserved, In Use, Under Maintenance, Faulty, or Sanitization Required
  const { eligibleCandidates, ineligibleAssets } = useMemo(() => {
    const eligible = [];
    const ineligible = [];

    matchingCategoryEquipment.forEach((item) => {
      // Safety check: only 'Available' assets with cleared sanitization are eligible
      if (item.status === 'Available' && item.sanitizationStatus !== 'PENDING') {
        const proximity = calculateModeledProximity(item.currentRoom, targetRoom);
        const isStale = isLocationStale(item);

        // Calculate transparent multi-factor suitability score
        let score = 100;

        // Proximity penalty (closer = higher score)
        if (proximity.minutes !== null) {
          score -= proximity.minutes * 6;
        } else {
          score -= 15;
        }

        // Battery readiness bonus/penalty
        if (item.hasBattery) {
          if (item.batteryLevel !== null) {
            if (item.batteryLevel < 40) score -= 25;
            else if (item.batteryLevel >= 85) score += 5;
          } else {
            score -= 10;
          }
        }

        // Stale location penalty (less confidence)
        if (isStale) {
          score -= 20;
        }

        eligible.push({
          ...item,
          proximity,
          isStale,
          suitabilityScore: Math.max(10, Math.min(100, Math.round(score))),
        });
      } else {
        let reason = `Blocked: Current status is "${item.status}"`;
        if (item.sanitizationStatus === 'PENDING') {
          reason = 'Blocked: Awaiting terminal chemical sanitization';
        } else if (item.status === 'In Use') {
          reason = `Blocked: Currently in clinical use (${item.currentRoom})`;
        } else if (item.status === 'Reserved') {
          reason = `Blocked: Active hold for ${item.reservation?.department || 'another department'}`;
        } else if (item.status === 'Faulty' || item.status === 'Under Maintenance') {
          reason = `Blocked: Bio-technical safety alert (${item.status})`;
        }
        ineligible.push({ ...item, rejectionReason: reason });
      }
    });

    // Rank eligible candidates: highest suitability score first
    eligible.sort((a, b) => b.suitabilityScore - a.suitabilityScore);

    return { eligibleCandidates: eligible, ineligibleAssets: ineligible };
  }, [matchingCategoryEquipment, targetRoom, isLocationStale]);

  // Quick Emergency Hold action
  const handleEmergencyHold = (candidate) => {
    setFeedbackMessage(null);

    // Recheck availability atomically before initiating
    if (candidate.status !== 'Available') {
      setFeedbackMessage({
        type: 'error',
        text: `Allocation failed: ${candidate.name} is no longer Available (Status: ${candidate.status}).`,
      });
      return;
    }

    const res = bookEquipment(candidate.id, {
      purpose: `CRITICAL OT/EMERGENCY ALLOCATION to ${targetRoom.name}`,
    });

    if (res.success) {
      setFeedbackMessage({
        type: 'success',
        text: `Emergency 30-minute hold confirmed for ${candidate.name} (${candidate.id})! Staff dispatch alerted to ${targetRoom.name}.`,
      });
      setSelectedCandidateId(candidate.id);
    } else {
      setFeedbackMessage({
        type: 'error',
        text: res.error || 'Failed to initiate reservation hold.',
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Emergency Header Banner */}
      <div className="emergency-header-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--status-faulty)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Siren size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 className="emergency-header-title">
                Emergency Allocation & Operating Theatre Dispatch
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: '#E11D48',
                  color: '#ffffff',
                }}
              >
                HIGH PRIORITY
              </span>
            </div>
            <p className="emergency-header-desc">
              Fast-track triage for critical medical equipment. Enforces safety eligibility and displays candidates based on modeled floor proximity and verified readiness.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="emergency-header-meta">
            Authorizing Clinician: <strong>{activePersona.name} ({activePersona.role})</strong>
          </span>
        </div>
      </div>

      {/* Target Destination & Equipment Category Selectors */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={18} color="var(--accent-blue)" />
            <strong style={{ fontSize: 15, color: 'var(--text-primary)' }}>
              1. Triage Requirements
            </strong>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Room-level tracking updated via authorized QR confirmations
          </span>
        </div>

        <div className="emergency-params-grid">
          {/* Target Destination Selector */}
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700 }}>
              Emergency Destination (Ward / Theatre) *
            </label>
            <select
              className="form-select"
              value={targetRoomName}
              onChange={(e) => setTargetRoomName(e.target.value)}
              style={{ fontWeight: 600 }}
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name} — {r.department} ({r.floor})
                </option>
              ))}
            </select>
          </div>

          {/* Equipment Category Selector */}
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700 }}>
              Required Equipment Category *
            </label>
            <select
              className="form-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ fontWeight: 600 }}
            >
              {emergencyCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Category Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)' }}>
            QUICK PRESETS:
          </span>
          {emergencyCategories.slice(0, 5).map((cat) => (
            <button
              key={cat}
              type="button"
              className={`status-pill ${selectedCategory === cat ? 'active' : ''}`}
              style={{ fontSize: 11.5, padding: '4px 10px' }}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Real-time Feedback Banner */}
      {feedbackMessage && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 'var(--radius-md)',
            backgroundColor:
              feedbackMessage.type === 'success' ? 'var(--status-ready-bg)' : 'var(--status-faulty-bg)',
            border: `1px solid ${
              feedbackMessage.type === 'success' ? 'var(--status-ready-border)' : 'var(--status-faulty-border)'
            }`,
            color: feedbackMessage.type === 'success' ? 'var(--status-ready)' : 'var(--status-faulty)',
            fontSize: 13.5,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {feedbackMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            style={{ fontSize: 11.5, fontWeight: 700, textDecoration: 'underline' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Results Grid: Candidates vs Modeled Floor Map */}
      <div className="emergency-main-grid">
        {/* Left Column: Ranked Eligible Candidates */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={18} color="var(--status-ready)" />
              <strong style={{ fontSize: 16, color: 'var(--text-primary)' }}>
                Eligible Candidates ({eligibleCandidates.length})
              </strong>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Ranked by proximity & verified readiness
            </span>
          </div>

          {eligibleCandidates.length === 0 ? (
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-card)',
                borderRadius: 'var(--radius-lg)',
                padding: '40px 24px',
                textAlign: 'center',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <AlertTriangle size={36} color="var(--status-reserved)" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                No Available {selectedCategory} Candidates Found
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto 16px', lineHeight: 1.5 }}>
                All matching units are currently in clinical use, reserved by other departments, undergoing terminal decontamination, or flagged for maintenance. Safety rules prevent unverified allocation.
              </p>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedCategory('All Categories')}
              >
                Broaden Search to All Categories
              </button>
            </div>
          ) : (
            eligibleCandidates.map((candidate, idx) => {
              const isSelected = selectedCandidateId === candidate.id;

              return (
                <div
                  key={candidate.id}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: `1px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border-card)'}`,
                    borderRadius: 'var(--radius-lg)',
                    padding: 18,
                    boxShadow: isSelected ? '0 0 0 2px var(--accent-blue-light)' : 'var(--shadow-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {/* Candidate Header Row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: idx === 0 ? 'var(--status-ready-bg)' : 'var(--bg-surface)',
                            color: idx === 0 ? 'var(--status-ready)' : 'var(--text-secondary)',
                            border: `1px solid ${idx === 0 ? 'var(--status-ready-border)' : 'var(--border-card)'}`,
                          }}
                        >
                          #{idx + 1} {idx === 0 ? 'RECOMMENDED' : 'CANDIDATE'}
                        </span>
                        <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                          {candidate.name}
                        </h4>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--accent-blue)', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                        {candidate.id} • {candidate.model} • SN: {candidate.serialNumber}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: candidate.suitabilityScore >= 80 ? 'var(--status-ready)' : 'var(--status-reserved)',
                        }}
                      >
                        {candidate.suitabilityScore}% Fit
                      </div>
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                        Suitability Index
                      </span>
                    </div>
                  </div>

                  {/* Candidate Metrics Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: 8,
                      backgroundColor: 'var(--bg-surface-subtle)',
                      padding: 10,
                      borderRadius: 'var(--radius-md)',
                      fontSize: 12,
                    }}
                  >
                    {/* Location & Proximity */}
                    <div>
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'block' }}>
                        LOCATION & PROXIMITY
                      </span>
                      <strong style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={12} color="var(--accent-blue)" />
                        {candidate.currentRoom.split(' ')[0]}
                      </strong>
                      <span style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600 }}>
                        {candidate.proximity.label}
                      </span>
                    </div>

                    {/* Battery Readiness */}
                    <div>
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'block' }}>
                        POWER & READINESS
                      </span>
                      {candidate.hasBattery && candidate.batteryLevel !== null ? (
                        <strong
                          style={{
                            color: candidate.batteryLevel > 70 ? 'var(--status-ready)' : 'var(--status-reserved)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Battery size={13} />
                          {candidate.batteryLevel}% Charge
                        </strong>
                      ) : (
                        <strong style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Zap size={12} />
                          Wall AC Powered
                        </strong>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Condition: {candidate.condition}
                      </span>
                    </div>

                    {/* Freshness */}
                    <div>
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'block' }}>
                        QR VERIFICATION
                      </span>
                      {candidate.isStale ? (
                        <strong style={{ color: 'var(--status-reserved)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertTriangle size={12} />
                          Stale (&gt;{staleThresholdHours}h)
                        </strong>
                      ) : (
                        <strong style={{ color: 'var(--status-ready)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={12} />
                          Freshly Confirmed
                        </strong>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {getRelativeTime(candidate.lastConfirmedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="candidate-action-buttons-row">
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: 12, padding: '6px 12px' }}
                      onClick={() => setInspectingEquipment(candidate)}
                    >
                      <Eye size={13} style={{ marginRight: 4 }} />
                      Inspect Specs
                    </button>

                    <div className="candidate-actions-right">
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: 12, padding: '6px 12px' }}
                        onClick={() => setBookingTargetEquipment(candidate)}
                      >
                        <CalendarCheck size={13} style={{ marginRight: 4 }} />
                        Configure Booking Form
                      </button>

                      <button
                        type="button"
                        className="btn-primary"
                        style={{
                          fontSize: 12,
                          padding: '6px 14px',
                          backgroundColor: '#E11D48',
                          borderColor: '#E11D48',
                        }}
                        onClick={() => handleEmergencyHold(candidate)}
                      >
                        <Siren size={13} style={{ marginRight: 4 }} />
                        Fast Emergency Hold (30m)
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Ineligible / Safety Audit Accordion */}
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowIneligibleAudit(!showIneligibleAudit)}
              style={{ width: '100%', justifyContent: 'space-between', fontSize: 12 }}
            >
              <span>
                Safety Governance: {ineligibleAssets.length} Matching Assets Excluded
              </span>
              <span>{showIneligibleAudit ? '▲ Hide Excluded' : '▼ View Excluded Safety Audit'}</span>
            </button>

            {showIneligibleAudit && (
              <div
                style={{
                  marginTop: 8,
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-card)',
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Equipment locked by infection control, active clinical use, or biomedical failure flags:
                </div>
                {ineligibleAssets.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      backgroundColor: 'var(--bg-card)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--text-primary)' }}>{item.name}</strong>{' '}
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-muted)' }}>
                        ({item.id})
                      </span>
                    </div>
                    <span style={{ color: 'var(--status-faulty)', fontWeight: 600, fontSize: 11 }}>
                      {item.rejectionReason}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Modeled Hospital Distribution & Route Reference */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={18} color="var(--accent-blue)" />
            <strong style={{ fontSize: 16, color: 'var(--text-primary)' }}>
              Hospital Floorplan & Target Dispatch
            </strong>
          </div>

          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              padding: 16,
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            {/* Target Room Card */}
            <div className="emergency-target-room-card">
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: '#E11D48',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <MapPin size={18} />
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--status-faulty)', fontWeight: 800 }}>
                  DESTINATION TARGET ROOM
                </span>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {targetRoom.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {targetRoom.floor} • {targetRoom.wing} ({targetRoom.department})
                </div>
              </div>
            </div>

            {/* Room Distribution List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                MODELED ROOM-LEVEL CANDIDATE SPREAD
              </span>

              {rooms.map((room) => {
                const candidatesInRoom = eligibleCandidates.filter((c) => c.currentRoom === room.name);
                const isTarget = room.name === targetRoom.name;

                return (
                  <div
                    key={room.id}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isTarget
                        ? '#FFF1F2'
                        : candidatesInRoom.length > 0
                        ? 'var(--status-ready-bg)'
                        : 'var(--bg-surface-subtle)',
                      border: `1px solid ${
                        isTarget
                          ? '#FECDD3'
                          : candidatesInRoom.length > 0
                          ? 'var(--status-ready-border)'
                          : 'var(--border-subtle)'
                      }`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--text-primary)' }}>{room.name.split(' ')[0]}</strong>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
                        {room.floor}
                      </span>
                    </div>

                    <div>
                      {isTarget ? (
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#E11D48' }}>
                          TARGET DESTINATION
                        </span>
                      ) : candidatesInRoom.length > 0 ? (
                        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--status-ready)' }}>
                          {candidatesInRoom.length} ready unit{candidatesInRoom.length > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          No units
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Architectural Modeling Disclaimer */}
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-surface)',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                lineHeight: 1.4,
              }}
            >
              <strong>Data Fidelity Guarantee:</strong> Transit estimates reflect modeled architectural floor/wing proximity. Equipment locations are updated strictly through authorized dual QR scans (room placard + device tag), not unverified continuous wireless telemetry.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
