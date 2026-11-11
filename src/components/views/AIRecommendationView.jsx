import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Battery,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Check,
  Layers,
  MapPin,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
  Info,
  RotateCcw,
  Navigation,
  QrCode,
  Radio,
  Clock,
} from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';
import { equipmentApi } from '../../api';
import RoomQRScannerModal from '../qr/RoomQRScannerModal';


// Pre-defined query presets for fast clinical testing
const QUERY_PRESETS = [
  {
    label: 'ICU Ward A: Nearby Ventilator',
    prompt: 'Clinician in ICU Ward A asks for a nearby ventilator based on route distance, battery runtime, readiness, and condition',
    room: 'ICU-201 (Bed A)',
  },
  {
    label: 'ER-101: Emergency Defibrillator',
    prompt: 'Need nearest available defibrillator for acute resuscitation in ER-101 with verified readiness',
    room: 'ER-101 (Trauma Bay 1)',
  },
  {
    label: 'Ward 3A: High Runtime Infusion Pump',
    prompt: 'Locate closest available infusion pump for Ward 3A with maximum battery runtime',
    room: 'Ward 3A (Room 305)',
  },
  {
    label: 'ICU-204: Point-of-Care Ultrasound',
    prompt: 'Find available portable ultrasound for emergency procedure in ICU-204',
    room: 'ICU-204 (Negative Pressure Isolation)',
  },
  {
    label: '120m Runtime Ventilator (ER-101)',
    prompt: 'Need available ventilator with 120 minutes verified runtime in ER-101',
    room: 'ER-101 (Trauma Bay 1)',
  },
];

export default function AIRecommendationView() {
  const {
    rooms,
    activePersona,
    setInspectingEquipment,
  } = useEquipment();

  // Clinician Current Location & Positioning State
  const [clinicianRoom, setClinicianRoom] = useState(
    rooms.find((r) => r.name.includes('ICU-201'))?.name ||
      rooms.find((r) => r.type === 'Critical Care')?.name ||
      rooms[0]?.name ||
      'ICU-201 (Bed A)'
  );
  const [locationSource, setLocationSource] = useState('MANUAL_SELECTION');
  const [locationConfidence, setLocationConfidence] = useState('MANUAL_UNVERIFIED');
  const [locationConfirmedAt, setLocationConfirmedAt] = useState(() => new Date().toISOString());
  const [isRoomQRModalOpen, setIsRoomQRModalOpen] = useState(false);

  // Natural Language & Structured Query State
  const [prompt, setPrompt] = useState(QUERY_PRESETS[0].prompt);
  const [selectedCategory, setSelectedCategory] = useState('Ventilator');
  const [urgency, setUrgency] = useState('urgent');
  const [minBatteryPercent, setMinBatteryPercent] = useState('');
  const [minRuntimeMinutes, setMinRuntimeMinutes] = useState('');
  const [requiredCapabilities, setRequiredCapabilities] = useState([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showIneligibleSection, setShowIneligibleSection] = useState(false);

  // Recommendation Results State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recommendationData, setRecommendationData] = useState(null);
  const [allocationNotice, setAllocationNotice] = useState(null);
  const [allocatingId, setAllocatingId] = useState(null);
  const [expandedRouteId, setExpandedRouteId] = useState(null);

  // Available equipment categories
  const categories = [
    'Ventilator',
    'Defibrillator',
    'Infusion Pump',
    'Portable Ultrasound',
    'ECG Machine',
    'Patient Monitor',
    'Transport Wheelchair',
  ];

  // Clinical capability options
  const capabilityOptions = [
    'Transport Ready',
    'Invasive',
    'Non-Invasive',
    'Pediatric',
    'Adult',
    'High Flow O2',
  ];

  const toggleCapability = (cap) => {
    setRequiredCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
    );
  };

  // Format relative timestamp helper
  const getRelativeTime = (isoString) => {
    if (!isoString) return 'Just now';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  // Room QR selection handler
  const handleRoomQRSelect = (selectedRoomObj, source = 'QR_SCAN') => {
    const roomName = selectedRoomObj.name || selectedRoomObj.id;
    setClinicianRoom(roomName);
    setLocationSource(source);
    setLocationConfidence(source === 'QR_SCAN' ? 'HIGH' : 'MANUAL_UNVERIFIED');
    const nowIso = new Date().toISOString();
    setLocationConfirmedAt(nowIso);
    handleExecuteQuery(undefined, roomName, source, nowIso, source === 'QR_SCAN' ? 'HIGH' : 'MANUAL_UNVERIFIED');
  };

  // Manual room dropdown change handler
  const handleManualRoomChange = (roomName) => {
    setClinicianRoom(roomName);
    setLocationSource('MANUAL_SELECTION');
    setLocationConfidence('MANUAL_UNVERIFIED');
    const nowIso = new Date().toISOString();
    setLocationConfirmedAt(nowIso);
    handleExecuteQuery(undefined, roomName, 'MANUAL_SELECTION', nowIso, 'MANUAL_UNVERIFIED');
  };

  // Execute recommendation query with hospital-wide discovery
  const handleExecuteQuery = useCallback(
    async (customPrompt, overrideRoom, overrideSource, overrideTime, overrideConf) => {
      setLoading(true);
      setError(null);
      setAllocationNotice(null);

      const targetRoom = overrideRoom || clinicianRoom;

      const queryPayload = {
        prompt: customPrompt !== undefined ? customPrompt : prompt,
        category: selectedCategory,
        clinicianRoom: targetRoom,
        destinationRoom: targetRoom,
        locationSource: overrideSource || locationSource,
        locationConfirmedAt: overrideTime || locationConfirmedAt,
        locationConfidence: overrideConf || locationConfidence,
        urgency,
        requiredCapabilities,
        minBatteryPercent: minBatteryPercent ? Number(minBatteryPercent) : null,
        minRuntimeMinutes: minRuntimeMinutes ? Number(minRuntimeMinutes) : null,
      };

      try {
        const result = await equipmentApi.getRecommendations(queryPayload);
        if (result && result.success) {
          setRecommendationData(result);
          if (result.query?.category) setSelectedCategory(result.query.category);
          if (result.clinicianLocation?.room) {
            setClinicianRoom(result.clinicianLocation.room);
          } else if (result.query?.clinicianRoom) {
            setClinicianRoom(result.query.clinicianRoom);
          }
        } else {
          throw new Error(result?.error || 'Failed to retrieve recommendations');
        }
      } catch (err) {
        console.warn('[SmartMed AI View] Live query failed:', err.message);
        setError(`Backend query failed (${err.message}). Make sure the Express server is connected to MongoDB.`);
      } finally {
        setLoading(false);
      }
    },
    [prompt, selectedCategory, clinicianRoom, locationSource, locationConfirmedAt, locationConfidence, urgency, requiredCapabilities, minBatteryPercent, minRuntimeMinutes]
  );

  // Initial load query
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const defaultDest = rooms.find((r) => r.type === 'Emergency')?.name || rooms[0]?.name || 'ER-101 (Trauma Bay 1)';
        const result = await equipmentApi.getRecommendations({
          prompt: QUERY_PRESETS[0].prompt,
          category: 'Ventilator',
          destinationRoom: defaultDest,
          urgency: 'urgent',
        });
        if (isMounted && result?.success) {
          setRecommendationData(result);
        }
      } catch (err) {
        if (isMounted) setError(`Initial load failed: ${err.message}`);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [rooms]);

  // Quick preset click
  const handlePresetSelect = (preset) => {
    setPrompt(preset.prompt);
    const targetRoom = preset.room || clinicianRoom;
    if (preset.room) {
      setClinicianRoom(preset.room);
    }
    handleExecuteQuery(preset.prompt, targetRoom);
  };

  // Authorize Clinical Allocation Hold
  const handleAuthorizeAllocation = async (candidate) => {
    setAllocatingId(candidate.equipment.id);
    setAllocationNotice(null);

    try {
      const res = await equipmentApi.allocateRecommendation({
        equipmentId: candidate.equipment.id,
        clinicianRoom,
        destinationRoom: clinicianRoom,
        purpose: `AI Emergency Hold for ${clinicianRoom} (${urgency.toUpperCase()})`,
        durationMinutes: 30,
      });

      if (res && res.success) {
        setAllocationNotice({
          type: 'success',
          text: `Success: ${candidate.equipment.name} (${candidate.equipment.id}) locked for 30-minute clinical hold. Dispatch route alerted to ${clinicianRoom}.`,
        });
        // Refresh recommendations to reflect updated status
        handleExecuteQuery();
      } else {
        throw new Error(res?.error || 'Failed to authorize allocation');
      }
    } catch (err) {
      setAllocationNotice({
        type: 'error',
        text: `Allocation failed: ${err.message}`,
      });
    } finally {
      setAllocatingId(null);
    }
  };

  const topCandidate = recommendationData?.topCandidate || null;
  const candidates = recommendationData?.candidates || [];
  const ineligibleAssets = recommendationData?.ineligibleAssets || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. Header Banner */}
      <div
        style={{
          padding: '20px 24px',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--accent-blue) 0%, #2563EB 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(29, 95, 193, 0.25)',
            }}
          >
            <BrainCircuit size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                SmartMed AI — Clinical Equipment Recommender
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'rgba(29, 95, 193, 0.12)',
                  color: 'var(--accent-blue)',
                  letterSpacing: '0.04em',
                }}
              >
                DECISION SUPPORT v2.0
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
              Intelligent asset triage using live battery status, architectural transit modeling, and verified safety clearances.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Authorizing Clinician: <strong style={{ color: 'var(--text-primary)' }}>{activePersona.name} ({activePersona.role})</strong>
          </span>
        </div>
      </div>

      {/* Clinician Current Location & Positioning Control Bar */}
      <div
        style={{
          padding: '18px 24px',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                color: 'var(--accent-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <MapPin size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  Clinician Current Location (Origin Node)
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: locationSource === 'QR_SCAN' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                    color: locationSource === 'QR_SCAN' ? 'var(--status-ready)' : 'var(--status-maintenance)',
                    border: `1px solid ${locationSource === 'QR_SCAN' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {locationSource === 'QR_SCAN' ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                  {locationSource === 'QR_SCAN' ? 'QR Scanned Placard (HIGH CONFIDENCE)' : 'Manual Selection (UNVERIFIED RTLS)'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 3 }}>
                <strong style={{ fontSize: 16, color: 'var(--text-primary)' }}>
                  {clinicianRoom}
                </strong>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  • Verified {getRelativeTime(locationConfirmedAt)}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setIsRoomQRModalOpen(true)}
              style={{
                fontSize: 12.5,
                padding: '8px 14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                backgroundColor: 'var(--accent-blue)',
              }}
            >
              <QrCode size={15} />
              <span>Scan Room QR Placard</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0, maxWidth: '100%' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Switch Room:</span>
              <select
                className="form-select"
                value={clinicianRoom}
                onChange={(e) => handleManualRoomChange(e.target.value)}
                style={{ fontSize: 12.5, padding: '7px 12px', minWidth: 0, maxWidth: '100%', flex: '1 1 180px' }}
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name} — {r.department} ({r.floor})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* RTLS / Hardware Positioning Boundary Disclosure */}
        <div
          style={{
            padding: '9px 14px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 11.5,
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Radio size={14} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
          <span>
            <strong>Positioning Integration Boundary:</strong> Automated indoor positioning (BLE beacons / UWB / RTLS tags) is not connected. Origin location is established by room QR placard scan or clinician manual selection. Transit calculations reflect hospital-wide graph corridor routes.
          </span>
        </div>
      </div>

      {/* Allocation Notice Banner */}
      {allocationNotice && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 'var(--radius-md)',
            backgroundColor:
              allocationNotice.type === 'success' ? 'var(--status-ready-bg)' : 'var(--status-faulty-bg)',
            border: `1px solid ${
              allocationNotice.type === 'success' ? 'var(--status-ready-border)' : 'var(--status-faulty-border)'
            }`,
            color: allocationNotice.type === 'success' ? 'var(--status-ready)' : 'var(--status-faulty)',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {allocationNotice.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{allocationNotice.text}</span>
        </div>
      )}

      {/* 2. Natural Language Request & Triage Controls */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '22px 24px',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="var(--accent-blue)" />
            <strong style={{ fontSize: 15, color: 'var(--text-primary)' }}>
              Natural-Language Clinical Request
            </strong>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Evaluates safety restrictions, transit minutes, and verified battery runtime
          </span>
        </div>

        {/* Input Bar */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleExecuteQuery()}
            placeholder="E.g., Find the best available ventilator for an emergency in ER-101 based on battery charge and distance..."
            style={{ flex: '1 1 200px', minWidth: 0, width: '100%', fontSize: 13.5, padding: '10px 14px' }}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={() => handleExecuteQuery()}
            disabled={loading}
            style={{ flex: '1 1 160px', minWidth: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {loading ? (
              <>
                <RotateCcw size={15} className="spinner" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <BrainCircuit size={16} />
                <span>Generate Advice</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Query Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Quick Prompts:
          </span>
          {QUERY_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="status-pill"
              onClick={() => handlePresetSelect(preset)}
              style={{ fontSize: 11.5, padding: '3px 10px' }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Structured Selectors Toggle */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--accent-blue)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <SlidersHorizontal size={13} />
            <span>{showAdvancedFilters ? 'Hide Structured Triage Options' : 'Adjust Structured Triage Constraints'}</span>
            {showAdvancedFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showAdvancedFilters && (
            <div
              style={{
                marginTop: 16,
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))',
                gap: 16,
              }}
            >
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Equipment Category
                </label>
                <select
                  className="form-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Clinician Current Room (Origin & Destination)
                </label>
                <select
                  className="form-select"
                  value={clinicianRoom}
                  onChange={(e) => handleManualRoomChange(e.target.value)}
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name} — {r.department} ({r.floor})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Triage Urgency
                </label>
                <select
                  className="form-select"
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value)}
                >
                  <option value="urgent">Critical Emergency (Prioritizes Proximity)</option>
                  <option value="standard">Standard Transport (Prioritizes Battery)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Min Battery Threshold (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="form-input"
                  placeholder="E.g. 50"
                  value={minBatteryPercent}
                  onChange={(e) => setMinBatteryPercent(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Min Verified Runtime (Mins)
                </label>
                <input
                  type="number"
                  min="0"
                  max="1440"
                  className="form-input"
                  placeholder="E.g. 120"
                  value={minRuntimeMinutes}
                  onChange={(e) => setMinRuntimeMinutes(e.target.value)}
                />
              </div>

              {/* Capabilities checklist */}
              <div style={{ gridColumn: '1 / -1' }}>
                <span className="form-label" style={{ fontWeight: 700, display: 'block', marginBottom: 8 }}>
                  Required Clinical Capabilities:
                </span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {capabilityOptions.map((cap) => {
                    const active = requiredCapabilities.includes(cap);
                    return (
                      <button
                        key={cap}
                        type="button"
                        className={`status-pill ${active ? 'active' : ''}`}
                        onClick={() => toggleCapability(cap)}
                        style={{ fontSize: 11.5 }}
                      >
                        {cap}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--status-faulty-bg)',
            border: '1px solid var(--status-faulty-border)',
            color: 'var(--status-faulty)',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 3. AI Executive Decision Support Summary */}
      {recommendationData && (
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 24px',
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={20} color="var(--status-ready)" />
              <strong style={{ fontSize: 16, color: 'var(--text-primary)' }}>
                Decision Support Synthesis
              </strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                Engine: {recommendationData.provider === 'gemini-1.5-flash' ? 'Gemini 1.5 Clinical LLM' : 'Deterministic Rules Engine'}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--status-ready-bg)',
                  color: 'var(--status-ready)',
                  border: '1px solid var(--status-ready-border)',
                }}
              >
                {candidates.length} Eligible Candidates
              </span>
            </div>
          </div>

          {/* Key Finding Box */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface)',
              borderLeft: '4px solid var(--accent-blue)',
              fontSize: 13.5,
              lineHeight: 1.5,
              color: 'var(--text-primary)',
            }}
          >
            <strong>Key Recommendation: </strong>
            <span>{recommendationData.keyFinding}</span>
            {topCandidate && (
              <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600 }}>
                (Leading Asset: {topCandidate.equipment.id} — {topCandidate.equipment.name})
              </span>
            )}
          </div>

          {/* Comparative analysis */}
          {recommendationData.comparativeAnalysis && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Comparative Analysis: </strong>
              <span>{recommendationData.comparativeAnalysis}</span>
            </div>
          )}

          {/* LLM Synthesis if provided */}
          {recommendationData.llmSynthesis && (
            <div
              style={{
                marginTop: 6,
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(29, 95, 193, 0.05)',
                border: '1px solid rgba(29, 95, 193, 0.15)',
                fontSize: 12.5,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                fontStyle: 'italic',
              }}
            >
              <strong style={{ fontStyle: 'normal', color: 'var(--accent-blue)' }}>AI Clinical Rationale: </strong>
              <span>{recommendationData.llmSynthesis}</span>
            </div>
          )}

          {/* Scoring weights breakdown disclosure */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              paddingTop: 12,
              borderTop: '1px solid var(--border-subtle)',
              fontSize: 11.5,
              color: 'var(--text-muted)',
              flexWrap: 'wrap',
            }}
          >
            <span>
              Configured Weights ({urgency.toUpperCase()}): Proximity ({Math.round((recommendationData.scoringWeights?.distance || 0.35) * 100)}%) • Battery ({Math.round((recommendationData.scoringWeights?.battery || 0.3) * 100)}%) • Readiness ({Math.round((recommendationData.scoringWeights?.readiness || 0.2) * 100)}%) • Compatibility ({Math.round((recommendationData.scoringWeights?.compatibility || 0.15) * 100)}%)
            </span>
          </div>
        </div>
      )}

      {/* 4. Ranked Candidate Cards */}
      {candidates.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Ranked Asset Candidates ({candidates.length})
            </h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Clinician Origin: {clinicianRoom}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {candidates.map((c) => {
              const isTop = c.rank === 1;
              const isAllocating = allocatingId === c.equipment.id;

              return (
                <div
                  key={c.equipment.id}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: `1px solid ${isTop ? 'var(--status-ready-border)' : 'var(--border-card)'}`,
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px 24px',
                    boxShadow: isTop ? '0 4px 16px rgba(34, 197, 94, 0.08)' : 'var(--shadow-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    position: 'relative',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {/* Top card row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Rank pill */}
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          padding: '4px 12px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: isTop ? 'var(--status-ready-bg)' : 'var(--bg-surface)',
                          color: isTop ? 'var(--status-ready)' : 'var(--text-secondary)',
                          border: `1px solid ${isTop ? 'var(--status-ready-border)' : 'var(--border-subtle)'}`,
                          letterSpacing: '0.04em',
                        }}
                      >
                        {isTop ? '★ #1 RECOMMENDED' : `#${c.rank} ALTERNATIVE`}
                      </span>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong style={{ fontSize: 16, color: 'var(--text-primary)' }}>
                            {c.equipment.name}
                          </strong>
                          <span className="equip-id-code">{c.equipment.id}</span>
                          <span className="status-pill" style={{ fontSize: 10.5, padding: '2px 8px' }}>
                            {c.equipment.category}
                          </span>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Model: {c.equipment.model} • Serial: {c.equipment.serialNumber}
                        </span>
                      </div>
                    </div>

                    {/* Overall Score Badge */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: 24, fontWeight: 900, color: isTop ? 'var(--status-ready)' : 'var(--accent-blue)' }}>
                          {c.overallScore}
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>/ 100</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                        Suitability Index
                      </span>
                    </div>
                  </div>

                  {/* Comparative Rank Rationale (Why it ranked above others) */}
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isTop ? 'rgba(34, 197, 94, 0.08)' : 'rgba(56, 189, 248, 0.06)',
                      border: `1px solid ${isTop ? 'rgba(34, 197, 94, 0.25)' : 'rgba(56, 189, 248, 0.2)'}`,
                      fontSize: 12.5,
                      lineHeight: 1.45,
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    <Sparkles size={15} color={isTop ? 'var(--status-ready)' : 'var(--accent-blue)'} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <strong style={{ color: isTop ? 'var(--status-ready)' : 'var(--accent-blue)' }}>
                        {isTop ? 'Why this ranks #1:' : `Rank #${c.rank} Comparative Assessment:`}
                      </strong>{' '}
                      <span>{c.rankRationale || (isTop ? 'Highest composite suitability index balancing transit route distance, verified runtime, and certified readiness.' : `Alternate option located in ${c.equipment.currentRoom} with ${c.metrics.transitMeters || 0}m transit.`)}</span>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))',
                      gap: 12,
                      padding: '14px 16px',
                      backgroundColor: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {/* Location & Transit */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                          Location & Transit
                        </span>
                        {c.metrics.transitMeters !== null && c.metrics.routeNavigable && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: c.metrics.floorChanges > 0 ? 'rgba(56, 189, 248, 0.12)' : 'rgba(34, 197, 94, 0.12)',
                              color: c.metrics.floorChanges > 0 ? 'var(--accent-blue)' : 'var(--status-ready)',
                              border: `1px solid ${c.metrics.floorChanges > 0 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(34, 197, 94, 0.25)'}`,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {c.metrics.transitMeters}m • {c.metrics.floorChanges > 0 ? `${c.metrics.floorChanges} Flr Change` : 'Same Floor'}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <MapPin size={14} color="var(--accent-blue)" />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {c.equipment.currentRoom}
                        </span>
                      </div>
                      <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'block', marginTop: 2 }}>
                        {c.metrics.transitLabel}
                      </span>

                      {/* Location Freshness Indicator */}
                      {c.metrics.locationFreshness && (
                        <div style={{ marginTop: 4 }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor:
                                c.metrics.locationFreshness === 'FRESH'
                                  ? 'rgba(34, 197, 94, 0.12)'
                                  : c.metrics.locationFreshness === 'MODERATE'
                                  ? 'rgba(56, 189, 248, 0.12)'
                                  : 'rgba(239, 68, 68, 0.12)',
                              color:
                                c.metrics.locationFreshness === 'FRESH'
                                  ? 'var(--status-ready)'
                                  : c.metrics.locationFreshness === 'MODERATE'
                                  ? 'var(--accent-blue)'
                                  : 'var(--status-faulty)',
                              border: `1px solid ${
                                c.metrics.locationFreshness === 'FRESH'
                                  ? 'rgba(34, 197, 94, 0.25)'
                                  : c.metrics.locationFreshness === 'MODERATE'
                                  ? 'rgba(56, 189, 248, 0.25)'
                                  : 'rgba(239, 68, 68, 0.25)'
                              }`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <Clock size={10} />
                            {c.metrics.locationFreshness === 'FRESH'
                              ? 'Location Fresh (<24h)'
                              : c.metrics.locationFreshness === 'MODERATE'
                              ? `Verified (${Math.round((c.metrics.locationAgeHours || 24) / 24)}d ago)`
                              : c.metrics.locationFreshness === 'STALE'
                              ? `Stale Location (${Math.round((c.metrics.locationAgeHours || 168) / 24)}d ago)`
                              : 'Unmodeled Location'}
                          </span>
                        </div>
                      )}

                      {/* Reachability Status */}
                      {c.metrics.routeNavigable === false && (
                        <div style={{ marginTop: 4, color: 'var(--status-faulty)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertTriangle size={12} />
                          <span>Unreachable: {c.metrics.unreachableReason || 'No corridor path'}</span>
                        </div>
                      )}

                      {c.metrics.routeSteps && c.metrics.routeSteps.length > 0 && c.metrics.routeNavigable && (
                        <div style={{ marginTop: 6 }}>
                          <button
                            type="button"
                            onClick={() => setExpandedRouteId(expandedRouteId === c.equipment.id ? null : c.equipment.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--accent-blue)',
                              fontSize: 11.5,
                              fontWeight: 600,
                              padding: 0,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Navigation size={12} />
                            <span>{expandedRouteId === c.equipment.id ? 'Hide Route Details' : 'View Navigable Route'}</span>
                            {expandedRouteId === c.equipment.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Battery & Runtime Intelligence */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                          Power & Runtime
                        </span>
                        {c.metrics.hasBattery && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor:
                                c.metrics.runtimeStatus === 'VERIFIED'
                                  ? 'rgba(34, 197, 94, 0.12)'
                                  : c.metrics.runtimeStatus === 'STALE'
                                  ? 'rgba(239, 68, 68, 0.12)'
                                  : 'rgba(234, 179, 8, 0.12)',
                              color:
                                c.metrics.runtimeStatus === 'VERIFIED'
                                  ? 'var(--status-ready)'
                                  : c.metrics.runtimeStatus === 'STALE'
                                  ? 'var(--status-faulty)'
                                  : 'var(--status-maintenance)',
                              border: `1px solid ${
                                c.metrics.runtimeStatus === 'VERIFIED'
                                  ? 'rgba(34, 197, 94, 0.25)'
                                  : c.metrics.runtimeStatus === 'STALE'
                                  ? 'rgba(239, 68, 68, 0.25)'
                                  : 'rgba(234, 179, 8, 0.25)'
                              }`,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {c.metrics.runtimeStatus === 'VERIFIED'
                              ? 'VERIFIED'
                              : c.metrics.runtimeStatus === 'STALE'
                              ? 'STALE CALIBRATION'
                              : c.metrics.runtimeStatus === 'ESTIMATED'
                              ? 'ESTIMATED'
                              : 'UNBENCHMARKED'}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Battery
                          size={14}
                          color={
                            !c.metrics.hasBattery
                              ? 'var(--text-muted)'
                              : c.metrics.batteryLevel > 50
                              ? 'var(--status-ready)'
                              : 'var(--status-maintenance)'
                          }
                        />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {c.metrics.hasBattery ? `${c.metrics.batteryLevel}% Charge` : 'AC Mains Only'}
                        </span>
                      </div>

                      <div style={{ marginTop: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontSize: 11.5, fontWeight: c.metrics.runtimeDisclosed ? 600 : 400, color: 'var(--text-secondary)' }}>
                          {c.metrics.runtimeDisclosed
                            ? `${c.metrics.verifiedRuntimeMinutes}m verified runtime`
                            : 'Runtime: Unbenchmarked'}
                        </span>
                        {c.metrics.runtimeSource && c.metrics.runtimeSource !== 'UNVERIFIED' && (
                          <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                            Source: {c.metrics.runtimeSource.replace(/_/g, ' ')}
                            {c.metrics.runtimeAgeDays !== null ? ` • Tested ${c.metrics.runtimeAgeDays}d ago` : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Readiness & Condition */}
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        Clinical Condition
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <ShieldCheck size={14} color="var(--status-ready)" />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {c.metrics.condition} Condition
                        </span>
                      </div>
                      <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                        {c.metrics.operatingHours} operating hours
                      </span>
                    </div>

                    {/* Sanitization Clearance */}
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        Decontamination Gate
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <CheckCircle2 size={14} color="var(--status-ready)" />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--status-ready)' }}>
                          Sanitization Verified
                        </span>
                      </div>
                      <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                        ISO 13485 Hygiene Standard
                      </span>
                    </div>
                  </div>

                  {/* Detailed Indoor Navigable Route Drawer */}
                  {expandedRouteId === c.equipment.id && c.metrics.routeSteps && (
                    <div
                      style={{
                        padding: '16px',
                        backgroundColor: 'var(--bg-surface-subtle, rgba(255,255,255,0.03))',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Navigation size={16} color="var(--accent-blue)" />
                          <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                            Shortest Navigable Route: {c.equipment.currentRoom} → {clinicianRoom}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className="phase-tag" style={{ fontSize: 10 }}>
                            Total: {c.metrics.transitMeters}m
                          </span>
                          <span className="phase-tag" style={{ fontSize: 10 }}>
                            Est. ~{c.metrics.transitMinutes} mins
                          </span>
                          {c.metrics.floorChanges > 0 && (
                            <span className="phase-tag" style={{ fontSize: 10, background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-blue)' }}>
                              {c.metrics.floorChanges} Flr Change ({c.metrics.elevatorUsed || 'Central Bed Elevator'})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Step-by-step path list */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {c.metrics.routeSteps.map((step) => (
                          <div
                            key={step.index}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 10,
                              fontSize: 12,
                              color: 'var(--text-primary)',
                              padding: '8px 12px',
                              backgroundColor: step.isElevator ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-card)',
                              borderLeft: `3px solid ${step.isElevator ? 'var(--accent-blue)' : 'var(--border-subtle)'}`,
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: step.isElevator ? 'var(--accent-blue)' : 'var(--text-muted)',
                                minWidth: 16,
                              }}
                            >
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

                      {/* Required Safety Disclaimer */}
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
                          <strong>Non-Live Tracking Disclaimer: </strong>
                          {c.metrics.routeDisclaimer || 'Architectural floor-plan route estimate based on last confirmed room scan. Never represents real-time physical or RTLS tracking.'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Runtime Warning Banner if any */}
                  {c.metrics.runtimeWarning && (
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor:
                          c.metrics.runtimeWarning === 'STALE_BENCHMARK'
                            ? 'rgba(239, 68, 68, 0.08)'
                            : 'rgba(234, 179, 8, 0.08)',
                        border: `1px solid ${
                          c.metrics.runtimeWarning === 'STALE_BENCHMARK'
                            ? 'rgba(239, 68, 68, 0.25)'
                            : 'rgba(234, 179, 8, 0.25)'
                        }`,
                        fontSize: 11.5,
                        color:
                          c.metrics.runtimeWarning === 'STALE_BENCHMARK'
                            ? 'var(--status-faulty)'
                            : 'var(--status-maintenance)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                      <span>
                        {c.metrics.runtimeWarning === 'STALE_BENCHMARK' && (
                          <>
                            <strong>Calibration Expired:</strong> Battery runtime measurement is over 90 days old ({c.metrics.runtimeAgeDays}d). Certified clinical recalibration required.
                          </>
                        )}
                        {c.metrics.runtimeWarning === 'UNVERIFIED_RUNTIME' && (
                          <>
                            <strong>Unbenchmarked Runtime:</strong> Score is derived from raw electrochemical battery charge. Operating duration is not guaranteed.
                          </>
                        )}
                        {c.metrics.runtimeWarning === 'ESTIMATED_RUNTIME' && (
                          <>
                            <strong>Estimated Runtime:</strong> Runtime duration is an algorithmic estimate, not a verified clinical load benchmark.
                          </>
                        )}
                        {c.metrics.runtimeWarning === 'MISSING_TELEMETRY' && (
                          <>
                            <strong>Missing Telemetry:</strong> Battery charge level is unconfirmed in equipment record.
                          </>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Stale Location Warning */}
                  {c.metrics.locationFreshness === 'STALE' && (
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        fontSize: 11.5,
                        color: 'var(--status-faulty)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                      <span>
                        <strong>Stale Location Warning:</strong> Last recorded scan in room is {c.metrics.locationAgeHours ? Math.round(c.metrics.locationAgeHours / 24) : '7+'} days old. Dispatcher must verify physical presence before bedside transport.
                      </span>
                    </div>
                  )}

                  {/* Route Impassable / Unreachable Route Warning */}
                  {c.metrics.routeNavigable === false && (
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        fontSize: 11.5,
                        color: 'var(--status-faulty)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                      <span>
                        <strong>Unreachable Asset Warning:</strong> No continuous corridor or elevator path exists between {c.equipment.currentRoom} and {clinicianRoom}. Device cannot be dispatched. Reason: {c.metrics.unreachableReason || 'Missing corridor link'}.
                      </span>
                    </div>
                  )}

                  {/* Disclosed Limitations if any */}
                  {c.disclosedLimitations.length > 0 && (
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'rgba(217, 119, 6, 0.08)',
                        border: '1px solid rgba(217, 119, 6, 0.2)',
                        fontSize: 11.5,
                        color: 'var(--status-maintenance)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <Info size={14} style={{ flexShrink: 0 }} />
                      <span><strong>Disclosure:</strong> {c.disclosedLimitations.join(' • ')}</span>
                    </div>
                  )}

                  {/* Card Action Footer */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                      paddingTop: 12,
                      borderTop: '1px solid var(--border-subtle)',
                    }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Subscores: Transit: {c.subscores.distance} • Battery: {c.subscores.battery} • Readiness: {c.subscores.readiness}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        type="button"
                        className="btn-inspect table-action-btn"
                        onClick={() => setInspectingEquipment(c.equipment)}
                        title="View complete technical specs"
                      >
                        <Eye size={13} />
                        <span>Inspect Specs</span>
                      </button>

                      <button
                        type="button"
                        className="btn-primary"
                        style={{ fontSize: 12.5, padding: '7px 16px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        onClick={() => handleAuthorizeAllocation(c)}
                        disabled={isAllocating}
                      >
                        {isAllocating ? (
                          <>
                            <RotateCcw size={14} className="spinner" />
                            <span>Confirming Hold...</span>
                          </>
                        ) : (
                          <>
                            <Check size={14} />
                            <span>Authorize Allocation Hold (30m)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Empty / No Eligible Candidates State */
        !loading && (
          <div
            style={{
              padding: '36px 24px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                backgroundColor: 'rgba(217, 119, 6, 0.12)',
                color: 'var(--status-maintenance)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle size={26} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              No Eligible {selectedCategory} Candidates Found
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 560, lineHeight: 1.5, margin: 0 }}>
              All inventory assets in this category are currently allocated, undergoing biomedical maintenance, or awaiting terminal sanitization. Mandatory safety restrictions prevent recommending unverified assets.
            </p>
            <span style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600 }}>
              Contact Biomedical Engineering in Basement 1 for expedited emergency allocation.
            </span>
          </div>
        )
      )}

      {/* 5. Top Candidates Comparison Matrix */}
      {candidates.length > 1 && (
        <div className="table-card">
          <div className="table-card-header">
            <div className="table-card-title">
              <Layers size={18} color="var(--accent-blue)" />
              <span>Side-by-Side Clinical Comparison Matrix</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Top candidates evaluated for {clinicianRoom}
            </span>
          </div>

          <div className="table-wrapper">
            <table className="clinical-table">
              <thead>
                <tr>
                  <th>Evaluation Metric</th>
                  {candidates.slice(0, 3).map((c) => (
                    <th key={c.equipment.id} style={{ textAlign: 'center' }}>
                      <span style={{ fontWeight: 800, color: c.rank === 1 ? 'var(--status-ready)' : 'var(--text-primary)' }}>
                        Rank #{c.rank}: {c.equipment.id}
                      </span>
                      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
                        {c.equipment.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Overall Suitability Score</strong></td>
                  {candidates.slice(0, 3).map((c) => (
                    <td key={c.equipment.id} style={{ textAlign: 'center' }}>
                      <strong style={{ fontSize: 16, color: c.rank === 1 ? 'var(--status-ready)' : 'var(--accent-blue)' }}>
                        {c.overallScore} / 100
                      </strong>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td><strong>Confirmed Location & Route</strong></td>
                  {candidates.slice(0, 3).map((c) => (
                    <td key={c.equipment.id} style={{ textAlign: 'center', fontSize: 12.5 }}>
                      <div>{c.equipment.currentRoom}</div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.metrics.transitLabel}</span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td><strong>Battery & Verified Runtime</strong></td>
                  {candidates.slice(0, 3).map((c) => (
                    <td key={c.equipment.id} style={{ textAlign: 'center', fontSize: 12.5 }}>
                      <div>{c.metrics.hasBattery ? `${c.metrics.batteryLevel}% Charge` : 'AC Mains'}</div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {c.metrics.runtimeDisclosed ? `${c.metrics.verifiedRuntimeMinutes}m runtime` : 'Unbenchmarked'}
                      </span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td><strong>Condition & Runtime Hours</strong></td>
                  {candidates.slice(0, 3).map((c) => (
                    <td key={c.equipment.id} style={{ textAlign: 'center', fontSize: 12.5 }}>
                      <div>{c.metrics.condition}</div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.metrics.operatingHours} hrs</span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Mandatory Safety Exclusions & Audit Disclosure */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '18px 24px',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={18} color="var(--status-maintenance)" />
            <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>
              Mandatory Safety Gate: Restricted Assets ({ineligibleAssets.length})
            </strong>
          </div>

          <button
            type="button"
            className="status-pill"
            onClick={() => setShowIneligibleSection((prev) => !prev)}
            style={{ fontSize: 11.5 }}
          >
            {showIneligibleSection ? 'Hide Excluded Assets' : 'View Safety Gate Audit'}
          </button>
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
          SmartMed enforces patient safety policies: equipment in active clinical use, quarantined in decontamination, or undergoing biomedical maintenance is strictly locked from recommendation, regardless of battery level or distance.
        </p>

        {showIneligibleSection && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ineligibleAssets.length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Zero restricted assets in this filter.</span>
            ) : (
              ineligibleAssets.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{item.name}</strong>
                    <span className="equip-id-code">{item.id}</span>
                    <span style={{ color: 'var(--text-muted)' }}>in {item.currentRoom}</span>
                  </div>
                  <span style={{ color: 'var(--status-faulty)', fontWeight: 600 }}>
                    {item.reason}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Room QR Scanner Modal */}
      <RoomQRScannerModal
        isOpen={isRoomQRModalOpen}
        onClose={() => setIsRoomQRModalOpen(false)}
        onSelectRoom={handleRoomQRSelect}
        rooms={rooms}
      />
    </div>
  );
}
