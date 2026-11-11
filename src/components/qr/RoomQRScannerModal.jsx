import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
  Html5QrcodeScannerState,
} from 'html5-qrcode';
import {
  X,
  Camera,
  CameraOff,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Search,
  Sparkles,
  SwitchCamera,
  Video,
} from 'lucide-react';
import { parseRoomQRPayload, classifyCameraError } from '../../utils/roomQrParser.js';
import { HOSPITAL_ROOMS } from '../../data/mockData.js';

export default function RoomQRScannerModal({
  isOpen,
  onClose,
  onSelectRoom,
  rooms = HOSPITAL_ROOMS,
}) {
  const roomsPool = Array.isArray(rooms) && rooms.length > 0 ? rooms : HOSPITAL_ROOMS;

  // Camera & Scanner State
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraErrorType, setCameraErrorType] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [liveHint, setLiveHint] = useState('');

  // Scanning Result & Feedback
  const [scanError, setScanError] = useState('');
  const [scanSuccessRoom, setScanSuccessRoom] = useState(null);

  // Tabs & Manual Fallback State
  const [activeTab, setActiveTab] = useState('camera'); // 'camera' | 'manual'
  const [manualCode, setManualCode] = useState('');
  const [selectedFallbackRoomId, setSelectedFallbackRoomId] = useState(
    roomsPool[0]?.id || 'RM-ICU-201'
  );

  // Instance & Concurrency Refs
  const scannerRef = useRef(null);
  const isStartingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const lastScanRef = useRef({ text: '', time: 0 });
  const isMountedRef = useRef(true);

  // Stop scanner and release all camera hardware tracks
  const stopScanner = useCallback(async () => {
    isStartingRef.current = false;

    // 1. Stop and clear Html5Qrcode instance
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (
          state === Html5QrcodeScannerState.SCANNING ||
          state === Html5QrcodeScannerState.PAUSED
        ) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('[RoomQRScanner] Stop scanner warning:', err?.message || err);
      }
      scannerRef.current = null;
    }

    // 2. Direct safety sweep: stop any remaining media stream tracks
    try {
      const videoElem = document.querySelector('#room-placard-qr-reader video');
      if (videoElem && videoElem.srcObject) {
        const stream = videoElem.srcObject;
        if (typeof stream.getTracks === 'function') {
          stream.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch {}
          });
        }
        videoElem.srcObject = null;
      }
    } catch (trackErr) {
      console.warn('[RoomQRScanner] Direct track stop warning:', trackErr);
    }

    if (isMountedRef.current) {
      setCameraActive(false);
      setCameraLoading(false);
      setLiveHint('');
    }
  }, []);

  // Safe close handler
  const handleClose = useCallback(async () => {
    await stopScanner();
    setScanError('');
    setScanSuccessRoom(null);
    onClose();
  }, [stopScanner, onClose]);

  // Handle successful QR code decode
  const handleDecodedQR = useCallback(
    async (decodedText) => {
      // Guard against rapid duplicate scans
      const now = Date.now();
      if (isProcessingRef.current) return;
      if (
        lastScanRef.current.text === decodedText &&
        now - lastScanRef.current.time < 2000
      ) {
        return;
      }
      lastScanRef.current = { text: decodedText, time: now };

      const validation = parseRoomQRPayload(decodedText, roomsPool);

      if (!validation.success) {
        // Keep scanner running, surface non-blocking clinical warning
        setScanError(validation.error);
        return;
      }

      // Valid room placard decoded!
      isProcessingRef.current = true;
      setScanError('');
      setScanSuccessRoom(validation.room);

      // Stop camera hardware immediately
      await stopScanner();

      // Commit origin update and close modal
      setTimeout(() => {
        onSelectRoom(validation.room, 'QR_SCAN');
        isProcessingRef.current = false;
        setScanSuccessRoom(null);
        onClose();
      }, 500);
    },
    [roomsPool, stopScanner, onSelectRoom, onClose]
  );

  // Start camera scanner
  const startScanner = useCallback(
    async (preferredDeviceId = null) => {
      // Prevent concurrent start calls
      if (isStartingRef.current) return;
      if (
        scannerRef.current &&
        (scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING ||
          scannerRef.current.getState() === Html5QrcodeScannerState.PAUSED)
      ) {
        return;
      }

      isStartingRef.current = true;
      setCameraLoading(true);
      setCameraError('');
      setCameraErrorType(null);
      setScanError('');
      setLiveHint('');

      // 1. Check Camera API availability and secure context
      const isLocal =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1' ||
          window.location.hostname === '[::1]');
      const isSecure = typeof window !== 'undefined' && (window.isSecureContext || isLocal);

      if (!isSecure) {
        setCameraLoading(false);
        setCameraErrorType('api_unavailable');
        setCameraError(
          'Camera API unavailable: Browser security requires HTTPS or localhost to access camera streams. Please use manual room selection.'
        );
        isStartingRef.current = false;
        return;
      }

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        setCameraLoading(false);
        setCameraErrorType('api_unavailable');
        setCameraError(
          'Camera API unavailable: Your browser does not support mediaDevices.getUserMedia. Please use manual room selection.'
        );
        isStartingRef.current = false;
        return;
      }

      // 2. Ensure container element exists in DOM
      const containerId = 'room-placard-qr-reader';
      const containerElem = document.getElementById(containerId);
      if (!containerElem) {
        console.warn('[RoomQRScanner] Scanner container element not found in DOM.');
        setCameraLoading(false);
        isStartingRef.current = false;
        return;
      }

      try {
        // Enumerate camera devices
        let deviceList = [];
        try {
          deviceList = await Html5Qrcode.getCameras();
          if (isMountedRef.current && Array.isArray(deviceList) && deviceList.length > 0) {
            setCameras(deviceList);
          }
        } catch (camListErr) {
          console.warn('[RoomQRScanner] Could not enumerate devices:', camListErr);
        }

        // 3. Create fresh Html5Qrcode instance
        const scanner = new Html5Qrcode(containerId, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        });
        scannerRef.current = scanner;

        // 4. Determine camera constraint
        const chosenId =
          preferredDeviceId ||
          selectedCameraId ||
          (deviceList.length > 0 ? deviceList[0].id : null);

        const cameraConfig =
          chosenId && deviceList.some((d) => d.id === chosenId)
            ? chosenId
            : { facingMode: 'environment' };

        const config = {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edgeSize = Math.max(160, Math.floor(minEdge * 0.72));
            return { width: edgeSize, height: edgeSize };
          },
          aspectRatio: 1.0,
        };

        // 5. Start camera with fallback
        try {
          await scanner.start(
            cameraConfig,
            config,
            (decodedText) => handleDecodedQR(decodedText),
            () => {
              // Frame scanned without QR detected - normal scanning loop
              if (isMountedRef.current) {
                setLiveHint('Camera active. QR code not detected yet — align room placard within frame.');
              }
            }
          );
        } catch (startErr) {
          // If environment facingMode failed, attempt user facingMode fallback
          if (
            !preferredDeviceId &&
            typeof cameraConfig === 'object' &&
            cameraConfig.facingMode === 'environment'
          ) {
            console.warn(
              '[RoomQRScanner] Environment camera failed, falling back to user camera:',
              startErr
            );
            await scanner.start(
              { facingMode: 'user' },
              config,
              (decodedText) => handleDecodedQR(decodedText),
              () => {
                if (isMountedRef.current) {
                  setLiveHint('Camera active. QR code not detected yet — align room placard within frame.');
                }
              }
            );
          } else {
            throw startErr;
          }
        }

        if (isMountedRef.current) {
          setCameraActive(true);
          setCameraLoading(false);
          setCameraError('');
          setCameraErrorType(null);
        }
      } catch (err) {
        console.warn('[RoomQRScanner] Camera start failed:', err);
        if (!isMountedRef.current) return;

        setCameraLoading(false);
        setCameraActive(false);

        const classified = classifyCameraError(err, { isSecure: true, hasMediaDevices: true });
        setCameraErrorType(classified.type);
        setCameraError(classified.message);
      } finally {
        isStartingRef.current = false;
      }
    },
    [selectedCameraId, handleDecodedQR]
  );

  // Switch camera when user chooses a different device
  const handleCameraChange = async (newDeviceId) => {
    setSelectedCameraId(newDeviceId);
    await stopScanner();
    await startScanner(newDeviceId);
  };

  // Manual barcode/identifier submit
  const handleManualCodeSubmit = (e) => {
    e?.preventDefault();
    setScanError('');
    const clean = manualCode.trim();
    if (!clean) return;

    const validation = parseRoomQRPayload(clean, roomsPool);
    if (validation.success) {
      onSelectRoom(validation.room, 'QR_SCAN');
      handleClose();
    } else {
      setScanError(validation.error);
    }
  };

  // Direct room selection submit
  const handleDirectSelectSubmit = () => {
    const target = roomsPool.find((r) => r.id === selectedFallbackRoomId) || roomsPool[0];
    if (target) {
      onSelectRoom(target, 'MANUAL_SELECTION');
      handleClose();
    }
  };

  // Lifecycle: cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopScanner();
    };
  }, [stopScanner]);

  // Lifecycle: start scanner when modal opens, stop when modal closes
  useEffect(() => {
    let timer = null;
    if (isOpen) {
      isProcessingRef.current = false;
      setScanError('');
      setScanSuccessRoom(null);
      // Initiate camera scan once the modal container renders into DOM
      timer = setTimeout(() => {
        startScanner();
      }, 80);
    } else {
      stopScanner();
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, startScanner, stopScanner]);

  if (!isOpen) return null;

  const floors = ['Floor 2', 'Floor 1', 'Floor 3', 'Basement 1'];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          maxHeight: '92vh',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-xl, 16px)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(56, 189, 248, 0.14)',
                color: 'var(--accent-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <QrCode size={20} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                Scan Clinician Location QR Placard
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                Verify clinician origin node using room wall placard
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 'var(--radius-sm)',
            }}
            aria-label="Close scanner dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-card)',
            padding: '0 20px',
            gap: 16,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            style={{
              padding: '12px 4px',
              background: 'none',
              border: 'none',
              borderBottom:
                activeTab === 'camera'
                  ? '2px solid var(--accent-blue)'
                  : '2px solid transparent',
              color: activeTab === 'camera' ? 'var(--accent-blue)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Camera size={15} />
            <span>Live Camera Scanner</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            style={{
              padding: '12px 4px',
              background: 'none',
              border: 'none',
              borderBottom:
                activeTab === 'manual'
                  ? '2px solid var(--accent-blue)'
                  : '2px solid transparent',
              color: activeTab === 'manual' ? 'var(--accent-blue)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Search size={15} />
            <span>Manual Selection Fallback</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div
          style={{
            padding: '18px 22px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* CAMERA TAB */}
          {activeTab === 'camera' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Camera Selector (when multiple cameras available) */}
              {cameras.length > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <SwitchCamera size={14} color="var(--accent-blue)" />
                    <span>Select Camera:</span>
                  </div>
                  <select
                    className="form-select"
                    value={selectedCameraId}
                    onChange={(e) => handleCameraChange(e.target.value)}
                    style={{ fontSize: 12, padding: '4px 8px', maxWidth: 260 }}
                  >
                    {cameras.map((c, idx) => (
                      <option key={c.id} value={c.id}>
                        {c.label || `Camera Device ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Viewfinder Outer Box */}
              <div
                style={{
                  borderRadius: 'var(--radius-lg, 12px)',
                  backgroundColor: '#0a0f1d',
                  border: '1px solid var(--border-card)',
                  overflow: 'hidden',
                  minHeight: 280,
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {/* Real Html5Qrcode video mount element */}
                <div
                  id="room-placard-qr-reader"
                  style={{
                    width: '100%',
                    maxWidth: 380,
                    margin: '0 auto',
                    position: 'relative',
                  }}
                />

                {/* State 1: Loading / Initializing */}
                {cameraLoading && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: 'rgba(10, 15, 29, 0.92)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 12,
                      color: 'var(--text-secondary)',
                      zIndex: 10,
                    }}
                  >
                    <RotateCcw size={28} className="spin" color="var(--accent-blue)" />
                    <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                      Requesting camera permission & initializing sensor...
                    </strong>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      Please allow camera access in your browser when prompted.
                    </span>
                  </div>
                )}

                {/* State 2: Camera Paused / Idle */}
                {!cameraActive && !cameraLoading && !cameraError && (
                  <div
                    style={{
                      padding: 28,
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 12,
                      color: 'var(--text-muted)',
                    }}
                  >
                    <CameraOff size={36} color="var(--text-secondary)" />
                    <span style={{ fontSize: 13 }}>Camera scanner is paused.</span>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => startScanner()}
                      style={{
                        fontSize: 13,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Camera size={15} />
                      Start Camera Scanner
                    </button>
                  </div>
                )}

                {/* State 3: Active Camera Controls & Overlay */}
                {cameraActive && (
                  <button
                    type="button"
                    onClick={stopScanner}
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      backgroundColor: 'rgba(0, 0, 0, 0.7)',
                      color: '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px 10px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      zIndex: 15,
                    }}
                  >
                    Pause Camera
                  </button>
                )}

                {/* State 4: Camera Errors (Categorized) */}
                {cameraError && !cameraActive && !cameraLoading && (
                  <div
                    style={{
                      padding: 24,
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 12,
                      maxWidth: 440,
                      zIndex: 10,
                    }}
                  >
                    <AlertTriangle size={36} color="var(--status-faulty)" />
                    <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                      {cameraErrorType === 'permission_denied'
                        ? 'Camera Permission Denied'
                        : cameraErrorType === 'camera_unavailable'
                        ? 'No Camera Device Found'
                        : cameraErrorType === 'camera_in_use'
                        ? 'Camera Already in Use'
                        : cameraErrorType === 'api_unavailable'
                        ? 'Camera API Unavailable'
                        : 'Camera Initialization Failed'}
                    </strong>
                    <p
                      style={{
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        margin: 0,
                        lineHeight: 1.45,
                      }}
                    >
                      {cameraError}
                    </p>
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => startScanner()}
                        style={{ fontSize: 12, padding: '7px 16px' }}
                      >
                        <RotateCcw size={13} style={{ display: 'inline', marginRight: 4 }} />
                        Retry Camera
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setActiveTab('manual')}
                        style={{ fontSize: 12, padding: '7px 16px' }}
                      >
                        Use Manual Fallback
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* State 5: QR Code Not Detected Yet (Live Hint) */}
              {cameraActive && liveHint && (
                <div
                  style={{
                    fontSize: 11.5,
                    color: 'var(--accent-blue)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    backgroundColor: 'rgba(56, 189, 248, 0.08)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                  }}
                >
                  <Video size={13} flexShrink={0} />
                  <span>{liveHint}</span>
                </div>
              )}

              {/* State 6: Successful Scan Banner */}
              {scanSuccessRoom && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(34, 197, 94, 0.15)',
                    border: '1px solid rgba(34, 197, 94, 0.4)',
                    color: 'var(--status-ready)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <CheckCircle2 size={20} flexShrink={0} />
                  <div>
                    <strong style={{ fontSize: 13, display: 'block' }}>
                      Room Placard Recognized: {scanSuccessRoom.name}
                    </strong>
                    <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                      {scanSuccessRoom.department} • {scanSuccessRoom.floor} (
                      {scanSuccessRoom.wing}). Updating clinician origin node...
                    </span>
                  </div>
                </div>
              )}

              {/* State 7: Validation Error Banner (Non-Blocking) */}
              {scanError && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: 'var(--status-faulty)',
                    fontSize: 12.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={16} flexShrink={0} />
                    <span>{scanError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScanError('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: 11,
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Instructions */}
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <Sparkles size={14} color="var(--accent-blue)" flexShrink={0} />
                <span>
                  Point camera at the room wall placard. Certified location source will be updated to{' '}
                  <strong>QR_SCAN (HIGH CONFIDENCE)</strong>.
                </span>
              </div>
            </div>
          )}

          {/* MANUAL TAB & FALLBACK */}
          {activeTab === 'manual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Form 1: Barcode / QR Code Text Entry */}
              <form
                onSubmit={handleManualCodeSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Enter Barcode Text or Scanned Placard ID:
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="E.g. SMARTMED://ROOM/RM-ICU-201, RM-ICU-201, ICU-201..."
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    style={{ flex: 1, fontSize: 13 }}
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ fontSize: 12.5, padding: '8px 16px' }}
                  >
                    Confirm Placard
                  </button>
                </div>
                {scanError && (
                  <span
                    style={{
                      fontSize: 11.5,
                      color: 'var(--status-faulty)',
                      fontWeight: 600,
                    }}
                  >
                    {scanError}
                  </span>
                )}
              </form>

              {/* Form 2: Direct Hospital Registry Dropdown */}
              <div
                style={{
                  padding: '14px 16px',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Direct Room Selection (Manual Fallback):
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <select
                    className="form-select"
                    value={selectedFallbackRoomId}
                    onChange={(e) => setSelectedFallbackRoomId(e.target.value)}
                    style={{ flex: 1, minWidth: 220, fontSize: 13 }}
                  >
                    {roomsPool.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.id} — {r.name} ({r.floor})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleDirectSelectSubmit}
                    style={{ fontSize: 12.5, padding: '8px 16px' }}
                  >
                    Set My Location
                  </button>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  * Manual selection sets origin status to{' '}
                  <strong>MANUAL_SELECTION (UNVERIFIED)</strong>.
                </span>
              </div>
            </div>
          )}

          {/* REGISTERED WALL PLACARDS (QUICK TAP REFERENCE) */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                Quick Tap Registered Wall Placards:
              </span>
              <span style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600 }}>
                High-Confidence QR Placard
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {floors.map((floorName) => {
                const floorRooms = roomsPool.filter((r) => r.floor === floorName);
                if (floorRooms.length === 0) return null;
                return (
                  <div key={floorName}>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        display: 'block',
                        marginBottom: 6,
                      }}
                    >
                      {floorName}
                    </span>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                        gap: 8,
                      }}
                    >
                      {floorRooms.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            onSelectRoom(r, 'QR_SCAN');
                            handleClose();
                          }}
                          style={{
                            padding: '10px 12px',
                            backgroundColor: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                            transition: 'all var(--transition-fast)',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent-blue)';
                            e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.08)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-subtle)';
                            e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                color: 'var(--accent-blue)',
                              }}
                            >
                              {r.id}
                            </span>
                            <QrCode size={12} color="var(--text-muted)" />
                          </div>
                          <strong
                            style={{
                              fontSize: 12,
                              color: 'var(--text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {r.name}
                          </strong>
                          <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                            {r.department}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 22px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button
            type="button"
            className="btn-secondary"
            onClick={handleClose}
            style={{ fontSize: 12.5, padding: '7px 16px' }}
          >
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
}
