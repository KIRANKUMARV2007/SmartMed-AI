import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  X,
  Camera,
  CameraOff,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  ArrowRight,
  Sparkles,
  MapPin,
} from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';

export default function QRScannerModal() {
  const {
    isQRScannerOpen,
    setIsQRScannerOpen,
    equipment,
    rooms,
    activePersona,
    executeDualScanMovement,
    setInspectingEquipment,
    setBookingTargetEquipment,
    setHandoverTargetEquipment,
  } = useEquipment();

  // Workflow modes: 'auto-move' (default automatic dual-scan), 'manual-fallback', 'quick-identify'
  const [workflowMode, setWorkflowMode] = useState('auto-move');

  // Remembered equipment for relocation (Step 1)
  const [pendingEquipment, setPendingEquipment] = useState(null);

  // Manual fallback room selection
  const [manualRoom, setManualRoom] = useState(null);

  // Unfinished movement conflict state (when scanning another equipment before room)
  const [conflictEquipment, setConflictEquipment] = useState(null);

  // Status feedback
  const [moveSuccess, setMoveSuccess] = useState(null);
  const [moveError, setMoveError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Camera state & debounce ref
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const html5QrCodeRef = useRef(null);
  const isHandlingScanRef = useRef(false);

  // Simulation selectors
  const [simEquipmentId, setSimEquipmentId] = useState('');
  const [simRoomId, setSimRoomId] = useState('');

  // Stop camera helper
  const stopCamera = useCallback(async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.warn('Error stopping camera:', err);
      }
    }
    setCameraActive(false);
  }, []);

  // Shared payload decoder
  const parseQRPayload = (text) => {
    const cleanText = text.trim();
    let equipId = null;
    let roomId = null;

    if (cleanText.includes('SMARTMED://EQUIPMENT/')) {
      equipId = cleanText.replace('SMARTMED://EQUIPMENT/', '');
    } else if (cleanText.startsWith('EQ-')) {
      equipId = cleanText;
    }

    if (cleanText.includes('SMARTMED://ROOM/')) {
      roomId = cleanText.replace('SMARTMED://ROOM/', '');
    } else if (cleanText.startsWith('RM-')) {
      roomId = cleanText;
    }

    return { equipId, roomId, raw: cleanText };
  };

  // Perform immediate atomic location update (Requirement 4, 5, 6, 7, 8, 11)
  const performAutomaticRelocation = useCallback(
    (equipItem, destRoomItem) => {
      setMoveError('');

      // Validation 1: Prevent moving to same room
      if (equipItem.currentRoom === destRoomItem.name) {
        setMoveError(`Equipment is already confirmed in ${destRoomItem.name}.`);
        setIsProcessing(false);
        return false;
      }

      // Requirement 8: Never show success before save
      setIsProcessing(true);

      const result = executeDualScanMovement(equipItem.id, destRoomItem.name);

      if (result.success) {
        // Requirement 7: Show success notification after update is saved
        setMoveSuccess({
          equipmentName: result.equipment.name,
          equipmentId: result.equipment.id,
          fromRoom: result.fromRoom,
          toRoom: result.toRoom,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          staffName: activePersona.name,
          staffRole: activePersona.role,
        });

        // Reset remembered equipment
        setPendingEquipment(null);
        setManualRoom(null);
        setConflictEquipment(null);
        setIsProcessing(false);
        return true;
      } else {
        setMoveError(result.error || 'Failed to update equipment location.');
        setIsProcessing(false);
        return false;
      }
    },
    [executeDualScanMovement, activePersona]
  );

  // Central QR Decoded Handler (used identically by camera & simulator)
  const handleDecodedQR = useCallback(
    (decodedText) => {
      // Debounce rapid camera frames
      if (isHandlingScanRef.current || isProcessing) return;
      isHandlingScanRef.current = true;
      setTimeout(() => {
        isHandlingScanRef.current = false;
      }, 1000);

      setMoveError('');

      const { equipId, roomId, raw } = parseQRPayload(decodedText);

      // -------------------------------------------------------------
      // CASE 1: EQUIPMENT QR SCANNED
      // -------------------------------------------------------------
      if (equipId) {
        const foundEquip = equipment.find((e) => e.id === equipId);
        if (!foundEquip) {
          setMoveError(`Equipment ID "${equipId}" was not found in the hospital registry.`);
          return;
        }

        // Mode: Quick Identify (direct inspection / booking / handover)
        if (workflowMode === 'quick-identify') {
          setIsQRScannerOpen(false);
          if (foundEquip.status === 'Available') {
            setBookingTargetEquipment(foundEquip);
          } else if (foundEquip.status === 'Reserved') {
            setHandoverTargetEquipment(foundEquip);
          } else {
            setInspectingEquipment(foundEquip);
          }
          return;
        }

        // Mode: Automatic Relocation or Manual Fallback
        // Requirement 9: If user scans an equipment QR again before scanning a room QR
        if (pendingEquipment) {
          if (pendingEquipment.id === foundEquip.id) {
            // Scanned the same equipment again
            setMoveError(
              `"${foundEquip.name}" (${foundEquip.id}) is already selected for movement. Please scan the destination room QR next.`
            );
          } else {
            // Scanned a DIFFERENT equipment before scanning a room QR: surface conflict prompt!
            setConflictEquipment(foundEquip);
          }
          return;
        }

        // Normal Step 1: Remember selected equipment
        setPendingEquipment(foundEquip);
        setMoveSuccess(null);
        return;
      }

      // -------------------------------------------------------------
      // CASE 2: ROOM QR SCANNED
      // -------------------------------------------------------------
      if (roomId) {
        const foundRoom = rooms.find((r) => r.id === roomId || r.name.includes(roomId));
        if (!foundRoom) {
          setMoveError(`Room identifier "${roomId}" not found in modeled floorplan.`);
          return;
        }

        // Check if an equipment is already remembered for movement
        if (pendingEquipment) {
          if (workflowMode === 'manual-fallback') {
            // In manual fallback, just select the room and wait for user to click Confirm
            setManualRoom(foundRoom);
            return;
          }

          // Requirement 4: Automatic relocation immediately after destination room scan!
          performAutomaticRelocation(pendingEquipment, foundRoom);
          return;
        } else {
          // Room scanned without equipment selected first
          setMoveError(
            `Destination Room "${foundRoom.name}" recognized. Please scan the Equipment QR code first to initiate a relocation.`
          );
          return;
        }
      }

      // -------------------------------------------------------------
      // CASE 3: UNRECOGNIZED QR FORMAT
      // -------------------------------------------------------------
      setMoveError(`Invalid QR code format: "${raw}". Must be a valid SmartMed Equipment or Room QR.`);
    },
    [
      equipment,
      rooms,
      pendingEquipment,
      workflowMode,
      isProcessing,
      performAutomaticRelocation,
      setIsQRScannerOpen,
      setBookingTargetEquipment,
      setHandoverTargetEquipment,
      setInspectingEquipment,
    ]
  );

  // Camera start helper with multi-tier mobile camera fallback
  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('html5-qr-reader');
      }

      // Responsive scanning box for narrow phones
      const boxSize = Math.min(220, Math.floor(window.innerWidth * 0.65));
      const config = { fps: 12, qrbox: { width: boxSize, height: boxSize } };

      // Tier 1: Try environment (rear) camera
      try {
        await html5QrCodeRef.current.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            handleDecodedQR(decodedText);
          },
          () => {}
        );
        setCameraActive(true);
        return;
      } catch (envErr) {
        console.warn('Rear camera not directly available, attempting fallback:', envErr);
      }

      // Tier 2: Fallback to any available camera (front or default)
      await html5QrCodeRef.current.start(
        { facingMode: 'user' },
        config,
        (decodedText) => {
          handleDecodedQR(decodedText);
        },
        () => {}
      );
      setCameraActive(true);
    } catch (err) {
      console.warn('Camera failed to start:', err);
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission') || err.message?.includes('denied')) {
        setCameraError(
          'Camera permission was denied. On mobile Android Chrome or Edge, tap the site settings / lock icon in the URL bar to allow Camera permissions, or use the instant simulation buttons below.'
        );
      } else if (err.name === 'NotFoundError' || err.message?.includes('found')) {
        setCameraError('No camera hardware was detected on this device. Please use the simulation controls below.');
      } else {
        setCameraError('Camera stream could not be initialized. Please use the simulation controls below.');
      }
      setCameraActive(false);
    }
  }, [handleDecodedQR]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Safe close handler that always stops camera streams
  const handleCloseModal = useCallback(() => {
    stopCamera();
    setIsQRScannerOpen(false);
  }, [stopCamera, setIsQRScannerOpen]);

  if (!isQRScannerOpen) return null;

  return (
    <div className="modal-backdrop" onClick={handleCloseModal}>
      <div
        className="modal-dialog"
        style={{ maxWidth: 740 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <QrCode size={20} color="var(--accent-cyan)" />
            <span>QR Scanner & Geolocation Relocation</span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={handleCloseModal}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Workflow Mode Tabs */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`status-pill ${workflowMode === 'auto-move' ? 'active' : ''}`}
              onClick={() => {
                setWorkflowMode('auto-move');
                setConflictEquipment(null);
              }}
            >
              <Sparkles size={13} style={{ display: 'inline', marginRight: 4 }} />
              Automatic 2-Scan Movement (Default)
            </button>
            <button
              type="button"
              className={`status-pill ${workflowMode === 'manual-fallback' ? 'active' : ''}`}
              onClick={() => {
                setWorkflowMode('manual-fallback');
                setConflictEquipment(null);
              }}
            >
              Manual Review Fallback
            </button>
            <button
              type="button"
              className={`status-pill ${workflowMode === 'quick-identify' ? 'active' : ''}`}
              onClick={() => {
                setWorkflowMode('quick-identify');
                setPendingEquipment(null);
                setConflictEquipment(null);
              }}
            >
              Quick Identify / Action
            </button>
          </div>

          {/* DUAL-SCAN STEP INDICATOR & REMEMBERED EQUIPMENT (Requirements 1, 2, 3, 4) */}
          {(workflowMode === 'auto-move' || workflowMode === 'manual-fallback') && (
            <div className="qr-steps-grid">
              {/* Step 1: Equipment */}
              <div
                style={{
                  padding: 12,
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: pendingEquipment ? 'var(--status-ready-bg)' : 'var(--bg-card)',
                  border: `1px solid ${pendingEquipment ? 'var(--status-ready-border)' : 'var(--border-card)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: pendingEquipment ? 'var(--status-ready)' : 'var(--text-muted)' }}>
                    STEP 1: EQUIPMENT SCAN
                  </span>
                  {pendingEquipment && (
                    <button
                      type="button"
                      onClick={() => setPendingEquipment(null)}
                      style={{ fontSize: 11, color: '#f87171', fontWeight: 600 }}
                      title="Clear selection"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {pendingEquipment ? (
                  <div>
                    <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                      {pendingEquipment.name}
                    </strong>
                    <div style={{ fontSize: 11, color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {pendingEquipment.id} • Status: {pendingEquipment.status}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      <MapPin size={11} style={{ display: 'inline', marginRight: 3 }} />
                      From: <strong>{pendingEquipment.currentRoom}</strong>
                    </div>
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Ready. Scan equipment QR code first...
                  </span>
                )}
              </div>

              {/* Step 2: Destination Room */}
              <div
                style={{
                  padding: 12,
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: pendingEquipment ? 'rgba(0, 180, 216, 0.08)' : 'var(--bg-card)',
                  border: `1px solid ${pendingEquipment ? 'rgba(0, 180, 216, 0.35)' : 'var(--border-card)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 800, color: pendingEquipment ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                  STEP 2: DESTINATION ROOM SCAN
                </span>

                {pendingEquipment ? (
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent-cyan)' }}>
                      {workflowMode === 'auto-move' ? 'Scan room QR to instantly move!' : 'Scan room QR to review...'}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {workflowMode === 'auto-move'
                        ? 'Location will update immediately without extra clicks.'
                        : 'Review and confirm relocation.'}
                    </span>
                    {manualRoom && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                        Selected: {manualRoom.name}
                      </div>
                    )}
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Waiting for equipment scan first...
                  </span>
                )}
              </div>
            </div>
          )}

          {/* UNFINISHED MOVEMENT CONFLICT DIALOG (Requirement 9) */}
          {conflictEquipment && pendingEquipment && (
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '2px solid rgba(245, 158, 11, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fbbf24', fontWeight: 700, fontSize: 13.5 }}>
                <AlertTriangle size={18} />
                <span>Unfinished Movement In Progress</span>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                You previously selected <strong>{pendingEquipment.name} ({pendingEquipment.id})</strong> for relocation, but just scanned another equipment: <strong>{conflictEquipment.name} ({conflictEquipment.id})</strong> before completing the room scan.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ fontSize: 12, height: 34, padding: '0 12px' }}
                  onClick={() => {
                    setPendingEquipment(conflictEquipment);
                    setConflictEquipment(null);
                  }}
                >
                  Switch to {conflictEquipment.id}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: 12, height: 34, padding: '0 12px' }}
                  onClick={() => setConflictEquipment(null)}
                >
                  Keep {pendingEquipment.id}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: 12, height: 34, padding: '0 12px', color: '#f87171' }}
                  onClick={() => {
                    setPendingEquipment(null);
                    setConflictEquipment(null);
                  }}
                >
                  Cancel Movement
                </button>
              </div>
            </div>
          )}

          {/* SUCCESS NOTIFICATION BANNER (Requirement 7) */}
          {moveSuccess && (
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                border: '2px solid rgba(16, 185, 129, 0.45)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--status-ready)', fontWeight: 800, fontSize: 14 }}>
                  <CheckCircle2 size={20} />
                  <span>Location Automatically Updated!</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMoveSuccess(null)}
                  style={{ fontSize: 11, color: 'var(--text-muted)' }}
                >
                  Dismiss
                </button>
              </div>

              <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                <strong>{moveSuccess.equipmentName}</strong> (<code>{moveSuccess.equipmentId}</code>)
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <span style={{ color: 'var(--text-muted)' }}>{moveSuccess.fromRoom}</span>
                <ArrowRight size={13} color="var(--accent-cyan)" />
                <strong style={{ color: 'var(--status-ready)' }}>{moveSuccess.toRoom}</strong>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid rgba(16, 185, 129, 0.2)', paddingTop: 6 }}>
                Verified by <strong>{moveSuccess.staffName} ({moveSuccess.staffRole})</strong> at {moveSuccess.timestamp}. Inventory, floor maps, and audit trail immediately updated.
              </div>
            </div>
          )}

          {/* ERROR NOTIFICATION BANNER (Requirement 8) */}
          {moveError && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertTriangle size={16} flexShrink={0} />
              <span>{moveError}</span>
            </div>
          )}

          {/* Live Camera View Box */}
          <div
            style={{
              borderRadius: 'var(--radius-lg)',
              backgroundColor: '#000000',
              overflow: 'hidden',
              minHeight: 200,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              border: '1px solid var(--border-card)',
            }}
          >
            <div id="html5-qr-reader" style={{ width: '100%', maxWidth: 360 }} />

            {!cameraActive && (
              <div
                style={{
                  padding: 24,
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  color: '#94a3b8',
                }}
              >
                <CameraOff size={32} color="#64748b" />
                <span style={{ fontSize: 13 }}>Camera scanner is currently paused.</span>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={startCamera}
                  style={{ fontSize: 13 }}
                >
                  <Camera size={16} />
                  Start Camera Scanner
                </button>
              </div>
            )}

            {cameraActive && (
              <button
                type="button"
                className="btn-secondary"
                onClick={stopCamera}
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  color: '#ffffff',
                }}
              >
                Stop Camera
              </button>
            )}
          </div>

          {cameraError && (
            <div style={{ fontSize: 12, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={14} />
              {cameraError}
            </div>
          )}

          {/* SIMULATION & MANUAL FALLBACK HUB (Requirement 10 & 12) */}
          <div
            style={{
              padding: 16,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                Demo Simulation Scanner (Identical Workflow Engine)
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Follows exact automatic 2-scan rules
              </span>
            </div>

            <div className="qr-sim-grid">
              {/* Simulate Equipment */}
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 11.5 }}>
                  1. Scan Equipment QR:
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    className="form-select"
                    style={{ flex: 1, fontSize: 12 }}
                    value={simEquipmentId}
                    onChange={(e) => setSimEquipmentId(e.target.value)}
                  >
                    <option value="">Select Equipment...</option>
                    {equipment.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.id} — {e.name.slice(0, 20)} ({e.currentRoom.split(' ')[0]})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '0 10px', fontSize: 12 }}
                    disabled={!simEquipmentId}
                    onClick={() => handleDecodedQR(`SMARTMED://EQUIPMENT/${simEquipmentId}`)}
                  >
                    Scan
                  </button>
                </div>
              </div>

              {/* Simulate Room */}
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 11.5 }}>
                  2. Scan Destination Room QR:
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    className="form-select"
                    style={{ flex: 1, fontSize: 12 }}
                    value={simRoomId}
                    onChange={(e) => setSimRoomId(e.target.value)}
                  >
                    <option value="">Select Room...</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '0 10px', fontSize: 12 }}
                    disabled={!simRoomId}
                    onClick={() => handleDecodedQR(`SMARTMED://ROOM/${simRoomId}`)}
                  >
                    Scan
                  </button>
                </div>
              </div>
            </div>

            {/* 1-Click Interactive Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                QUICK DEMO TEST:
              </span>
              <button
                type="button"
                className="status-pill"
                style={{ fontSize: 11, padding: '3px 8px' }}
                onClick={() => handleDecodedQR('SMARTMED://EQUIPMENT/EQ-VENT-02')}
              >
                1. Scan EQ-VENT-02
              </button>
              <button
                type="button"
                className="status-pill"
                style={{ fontSize: 11, padding: '3px 8px' }}
                onClick={() => handleDecodedQR('SMARTMED://ROOM/RM-ER-101')}
              >
                2. Scan Room ER-101 (Auto-Moves!)
              </button>
              <button
                type="button"
                className="status-pill"
                style={{ fontSize: 11, padding: '3px 8px' }}
                onClick={() => handleDecodedQR('SMARTMED://ROOM/RM-ICU-201')}
              >
                Scan Room ICU-201
              </button>
              <button
                type="button"
                className="status-pill"
                style={{ fontSize: 11, padding: '3px 8px', color: '#f59e0b' }}
                onClick={() => handleDecodedQR('SMARTMED://EQUIPMENT/EQ-VENT-03')}
                title="Test unfinished movement conflict handling"
              >
                Test Conflict: Scan EQ-VENT-03
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <UserCheck size={14} color="var(--accent-cyan)" />
            <span>
              Responsible Staff Persona:{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{activePersona.name} ({activePersona.role})</strong>
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCloseModal}
            >
              Close
            </button>
            {workflowMode === 'manual-fallback' && (
              <button
                type="button"
                className="btn-primary"
                disabled={!pendingEquipment || !manualRoom || isProcessing}
                onClick={() => performAutomaticRelocation(pendingEquipment, manualRoom)}
                style={{ opacity: pendingEquipment && manualRoom ? 1 : 0.4 }}
              >
                <CheckCircle2 size={16} />
                Confirm Movement (Manual)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
