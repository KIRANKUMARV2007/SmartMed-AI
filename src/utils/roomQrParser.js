import { HOSPITAL_ROOMS } from '../data/mockData.js';

/**
 * Normalizes hospital room codes for resilient comparison.
 * Handles variances like 'RM-OT-01' vs 'OT-1', 'PACU-1' vs 'RM-PACU-01'.
 */
function normalizeCode(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toUpperCase()
    .trim()
    .replace(/^RM-/, '')
    .replace(/-(0+)(\d+)/, '-$2');
}

/**
 * Standard hospital clinical aliases mapping.
 * Matches common spoken, abbreviated, or badge terms to canonical room IDs.
 */
const CLINICAL_ROOM_ALIASES = {
  // ICU Floor 2
  'icu ward a': 'RM-ICU-201',
  'icu bed a': 'RM-ICU-201',
  'icu-201': 'RM-ICU-201',
  'icu 201': 'RM-ICU-201',
  'icu ward b': 'RM-ICU-202',
  'icu bed b': 'RM-ICU-202',
  'icu-202': 'RM-ICU-202',
  'icu 202': 'RM-ICU-202',
  'icu ward c': 'RM-ICU-203',
  'icu bed c': 'RM-ICU-203',
  'icu-203': 'RM-ICU-203',
  'icu 203': 'RM-ICU-203',
  'icu-204': 'RM-ICU-204',
  'icu 204': 'RM-ICU-204',
  'negative pressure isolation': 'RM-ICU-204',
  'nicu-205': 'RM-NICU-205',
  'nicu 205': 'RM-NICU-205',
  'neonatal icu': 'RM-NICU-205',
  'ccu-206': 'RM-CCU-206',
  'ccu 206': 'RM-CCU-206',
  'cardiac care unit': 'RM-CCU-206',
  'stor-f2': 'RM-STOR-F2',

  // ER Floor 1
  'er-101': 'RM-ER-101',
  'er 101': 'RM-ER-101',
  'trauma bay 1': 'RM-ER-101',
  'trauma 1': 'RM-ER-101',
  'er-102': 'RM-ER-102',
  'er 102': 'RM-ER-102',
  'acute resus': 'RM-ER-102',
  'resus': 'RM-ER-102',
  'er-103': 'RM-ER-103',
  'er 103': 'RM-ER-103',
  'triage': 'RM-ER-103',
  'rapid assessment': 'RM-ER-103',
  'er-104': 'RM-ER-104',
  'er 104': 'RM-ER-104',
  'pediatric er': 'RM-ER-104',
  'pediatric emergency': 'RM-ER-104',
  'rad-101': 'RM-RAD-101',
  'radiology': 'RM-RAD-101',
  'ct suite': 'RM-RAD-101',
  'diagnostic imaging': 'RM-RAD-101',
  'stor-f1': 'RM-STOR-F1',

  // Operating Theatres Floor 3
  'ot-1': 'RM-OT-01',
  'ot 1': 'RM-OT-01',
  'ot-01': 'RM-OT-01',
  'general surgery': 'RM-OT-01',
  'ot-2': 'RM-OT-02',
  'ot 2': 'RM-OT-02',
  'ot-02': 'RM-OT-02',
  'cardiothoracic': 'RM-OT-02',
  'ot-3': 'RM-OT-03',
  'ot 3': 'RM-OT-03',
  'ot-03': 'RM-OT-03',
  'orthopedic theatre': 'RM-OT-03',
  'pacu': 'RM-PACU-01',
  'pacu-1': 'RM-PACU-01',
  'pacu-01': 'RM-PACU-01',
  'post-anesthesia': 'RM-PACU-01',
  'ward 3a': 'RM-W3A-05',
  'w3a-05': 'RM-W3A-05',
  'room 305': 'RM-W3A-05',
  'ward 3b': 'RM-W3B-12',
  'w3b-12': 'RM-W3B-12',
  'room 312': 'RM-W3B-12',
  'ward 3c': 'RM-W3C-20',
  'w3c-20': 'RM-W3C-20',
  'room 320': 'RM-W3C-20',
  'step-down 320': 'RM-W3C-20',
  'stor-f3': 'RM-STOR-F3',

  // Basement 1
  'biomed': 'RM-BIOMED-B1',
  'biomedical workshop': 'RM-BIOMED-B1',
  'biomed workshop': 'RM-BIOMED-B1',
  'biomed-b1': 'RM-BIOMED-B1',
  'san-bay': 'RM-SAN-BAY',
  'sanitization bay': 'RM-SAN-BAY',
  'decon bay': 'RM-SAN-BAY',
  'clean storage': 'RM-STOR-B1',
  'stor-b1': 'RM-STOR-B1',
};

/**
 * Searches the hospital rooms pool for a room matching the candidate string.
 * Strictly adheres to authentic hospital rooms; does not match arbitrary text.
 */
export function findMatchingRoom(candidate, roomsPool = HOSPITAL_ROOMS) {
  if (!candidate || typeof candidate !== 'string') return null;
  const clean = candidate.trim();
  if (!clean) return null;

  const lower = clean.toLowerCase();
  const upper = clean.toUpperCase();

  // 1. Exact ID match (case-insensitive)
  let match = roomsPool.find((r) => r.id.toUpperCase() === upper);
  if (match) return match;

  // 2. Exact Name match (case-insensitive)
  match = roomsPool.find((r) => r.name.toLowerCase() === lower);
  if (match) return match;

  // 3. ID without 'RM-' prefix matching candidate without 'RM-' prefix
  const candNoPrefix = upper.replace(/^RM-/, '');
  match = roomsPool.find((r) => r.id.replace(/^RM-/, '').toUpperCase() === candNoPrefix);
  if (match) return match;

  // 4. Zero-padded vs non-zero padded normalized code
  const normalizedCand = normalizeCode(clean);
  match = roomsPool.find((r) => normalizeCode(r.id) === normalizedCand);
  if (match) return match;

  // 5. Explicit Clinical Room Alias
  const mappedTargetId = CLINICAL_ROOM_ALIASES[lower];
  if (mappedTargetId) {
    match = roomsPool.find((r) => r.id.toUpperCase() === mappedTargetId);
    if (match) return match;
  }

  // 6. Name Prefix Token Match: e.g. 'ER-101' at start of 'ER-101 (Trauma Bay 1)'
  // Only allowed if candidate looks like a structured clinical code (letters-dash-numbers)
  if (/^[A-Z0-9]{2,6}-\d+/i.test(candNoPrefix)) {
    match = roomsPool.find((r) => {
      const roomNoPrefix = r.id.replace(/^RM-/, '').toUpperCase();
      if (roomNoPrefix === candNoPrefix) return true;
      const roomFirstToken = r.name.split(' ')[0].replace(/^RM-/, '').toUpperCase();
      return roomFirstToken === candNoPrefix;
    });
    if (match) return match;
  }

  return null;
}

/**
 * Robustly parses a QR code payload scanned from a room wall placard or manual input.
 * Supports:
 * - SMARTMED://ROOM/<id> URI scheme (standard app placard format)
 * - JSON payloads: {"roomId": "..."}, {"type": "room", "id": "..."}, etc.
 * - URL queries / paths: https://.../?room=RM-ICU-201
 * - Raw room IDs and clinical aliases: RM-ICU-201, ICU-201, ER-101, etc.
 *
 * Explicitly rejects:
 * - Equipment QR codes (SMARTMED://EQUIPMENT/..., EQ-..., {"type": "equipment"})
 * - Arbitrary text / unrecognized strings ("hello", "12345", etc.)
 *
 * @param {string} text - Scanned raw string
 * @param {Array} availableRooms - List of rooms in the active hospital registry
 * @returns {{ success: boolean, room?: object, error?: string, isEquipment: boolean, raw: string }}
 */
export function parseRoomQRPayload(text, availableRooms = HOSPITAL_ROOMS) {
  if (!text || typeof text !== 'string') {
    return {
      success: false,
      error: 'Empty or invalid QR code content.',
      isEquipment: false,
      raw: text || '',
    };
  }

  const raw = text.trim();
  if (!raw) {
    return {
      success: false,
      error: 'Empty QR code content.',
      isEquipment: false,
      raw,
    };
  }

  // 1. Immediately flag Equipment QR codes to give precise clinical error guidance
  if (/^SMARTMED:\/\/EQUIPMENT\//i.test(raw)) {
    const eqId = raw.replace(/^SMARTMED:\/\/EQUIPMENT\//i, '').trim();
    return {
      success: false,
      error: `Scanned QR is an Equipment tag (${eqId || 'Asset'}), not a Room Location Placard.`,
      isEquipment: true,
      raw,
    };
  }
  if (/^EQ-[A-Z0-9-]+$/i.test(raw)) {
    return {
      success: false,
      error: `Scanned QR is an Equipment identifier (${raw}), not a Room Location Placard.`,
      isEquipment: true,
      raw,
    };
  }

  let candidate = raw;

  // 2. JSON payload decoding
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.type === 'equipment' || parsed.equipmentId || parsed.equipId) {
        const eqId = parsed.equipmentId || parsed.equipId || parsed.id || 'Asset';
        return {
          success: false,
          error: `Scanned JSON payload is an Equipment tag (${eqId}), not a Room Location Placard.`,
          isEquipment: true,
          raw,
        };
      }
      if (parsed.roomId) candidate = String(parsed.roomId).trim();
      else if (parsed.type === 'room' && parsed.id) candidate = String(parsed.id).trim();
      else if (parsed.room) candidate = String(parsed.room).trim();
      else if (parsed.roomName) candidate = String(parsed.roomName).trim();
      else if (parsed.id && /^RM-/i.test(parsed.id)) candidate = String(parsed.id).trim();
    } catch {
      // not valid JSON, proceed as plain string
    }
  }

  // 3. SMARTMED://ROOM/ URI scheme (case-insensitive)
  if (/^SMARTMED:\/\/ROOM\//i.test(candidate)) {
    candidate = candidate.replace(/^SMARTMED:\/\/ROOM\//i, '').trim();
  }

  // 4. URL format parsing (e.g. https://smartmed.hospital/?room=RM-ICU-201)
  if (/^https?:\/\//i.test(candidate)) {
    try {
      const url = new URL(candidate);
      const roomParam =
        url.searchParams.get('room') ||
        url.searchParams.get('roomId') ||
        url.searchParams.get('r') ||
        url.searchParams.get('roomCode');
      if (roomParam) {
        candidate = roomParam.trim();
      } else {
        const pathParts = url.pathname.split('/').filter(Boolean);
        const lastPart = pathParts[pathParts.length - 1];
        if (
          lastPart &&
          (/^RM-/i.test(lastPart) ||
            /^(ICU|ER|OT|PACU|RAD|WARD|W3|STOR|SAN|BIOMED)/i.test(lastPart))
        ) {
          candidate = lastPart.trim();
        }
      }
    } catch {
      // ignore URL parsing error
    }
  }

  const cleanCandidate = candidate.trim();
  const roomsPool =
    Array.isArray(availableRooms) && availableRooms.length > 0
      ? availableRooms
      : HOSPITAL_ROOMS;

  const foundRoom = findMatchingRoom(cleanCandidate, roomsPool);

  if (foundRoom) {
    return {
      success: true,
      room: foundRoom,
      raw,
      candidate: cleanCandidate,
    };
  }

  return {
    success: false,
    error: `Room placard '${cleanCandidate}' was not recognized in the hospital registry.`,
    isEquipment: false,
    raw,
  };
}

/**
 * Classifies camera errors into standard clinical states
 * @param {Error|object} err - Caught error
 * @param {{ isSecure?: boolean, hasMediaDevices?: boolean }} context - Runtime context
 * @returns {{ type: string, message: string }}
 */
export function classifyCameraError(err, context = {}) {
  const { isSecure = true, hasMediaDevices = true } = context;

  if (!isSecure) {
    return {
      type: 'api_unavailable',
      message:
        'Camera API unavailable: Browser security requires HTTPS or localhost to access camera streams. Please use manual room selection.',
    };
  }

  if (!hasMediaDevices) {
    return {
      type: 'api_unavailable',
      message:
        'Camera API unavailable: Your browser does not support mediaDevices.getUserMedia. Please use manual room selection.',
    };
  }

  const errName = err?.name || '';
  const errMsg = String(err?.message || err);

  if (
    errName === 'NotAllowedError' ||
    errName === 'PermissionDeniedError' ||
    /permission/i.test(errMsg) ||
    /denied/i.test(errMsg)
  ) {
    return {
      type: 'permission_denied',
      message:
        'Camera permission denied. Please allow camera permissions in your browser address bar settings to scan room placards.',
    };
  }

  if (
    errName === 'NotFoundError' ||
    errName === 'DevicesNotFoundError' ||
    /not found/i.test(errMsg) ||
    /no camera/i.test(errMsg)
  ) {
    return {
      type: 'camera_unavailable',
      message:
        'No camera device found on this system. Please connect a camera or use manual room selection below.',
    };
  }

  if (
    errName === 'NotReadableError' ||
    errName === 'TrackStartError' ||
    errName === 'SourceUnavailableError' ||
    /in use/i.test(errMsg) ||
    /readable/i.test(errMsg)
  ) {
    return {
      type: 'camera_in_use',
      message:
        'Camera is already in use by another application or browser tab. Please close other camera applications and try again.',
    };
  }

  if (errName === 'OverconstrainedError') {
    return {
      type: 'overconstrained',
      message:
        'Camera resolution or constraint not supported by your hardware. Tap Retry Camera to attempt standard resolution.',
    };
  }

  return {
    type: 'init_failed',
    message: `Camera initialization or decoding failure: ${errMsg}. Please retry or use manual room selection.`,
  };
}

