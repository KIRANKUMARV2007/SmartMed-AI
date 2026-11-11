/**
 * SmartMed AI - Core Equipment Recommendation & Decision Support Engine
 *
 * Implements:
 * 1. Natural-language intent extraction
 * 2. Strict safety eligibility filtering (Never overridable by battery or distance)
 * 3. Floor-plan transit distance & time modeling
 * 4. Transparent multi-factor scoring with documented weights
 * 5. Disclosed limitations (verified runtime vs raw percentage; route estimations)
 * 6. Clinical explanation generation (Deterministic + Optional LLM synthesis)
 */

import { findShortestRoute } from './indoorNavigation.js';

// Architectural floor index mapping for vertical elevator transit calculations
const FLOOR_LEVEL_INDEX = {
  'Basement 1': 0,
  'Floor 1': 1,
  'Floor 2': 2,
  'Floor 3': 3,
};

// Configurable scoring weights
export const SCORING_WEIGHTS = {
  urgent: {
    distance: 0.35,
    battery: 0.30,
    readiness: 0.20,
    compatibility: 0.15,
  },
  standard: {
    battery: 0.35,
    compatibility: 0.30,
    distance: 0.20,
    readiness: 0.15,
  },
};

/**
 * Natural language prompt parser for clinical queries
 * Extracts category, destination room, urgency, and capability hints.
 */
export function parseNaturalLanguageQuery(prompt, availableRooms = []) {
  if (!prompt || typeof prompt !== 'string') {
    const defaultRoom = availableRooms[0]?.name || 'ER-101 (Trauma Bay 1)';
    return {
      category: 'Ventilator',
      clinicianRoom: defaultRoom,
      destinationRoom: defaultRoom,
      urgency: 'urgent',
      requiredCapabilities: [],
    };
  }

  const text = prompt.toLowerCase();

  // 1. Equipment Category Extraction
  let category = 'Ventilator';
  if (text.includes('defibrillator') || text.includes('defib') || text.includes('zoll')) {
    category = 'Defibrillator';
  } else if (text.includes('infusion') || text.includes('pump') || text.includes('alaris')) {
    category = 'Infusion Pump';
  } else if (text.includes('ultrasound') || text.includes('sonosite') || text.includes('echo')) {
    category = 'Portable Ultrasound';
  } else if (text.includes('ecg') || text.includes('ekg') || text.includes('electrocardiogram')) {
    category = 'ECG Machine';
  } else if (text.includes('monitor') || text.includes('vitals')) {
    category = 'Patient Monitor';
  } else if (text.includes('wheelchair') || text.includes('transport chair')) {
    category = 'Transport Wheelchair';
  } else if (text.includes('ventilator') || text.includes('vent') || text.includes('respirator')) {
    category = 'Ventilator';
  }

  // 2. Clinician Current Location / Target Room Extraction
  let clinicianRoom = null;

  // Handle clinical expressions like "icu ward a", "icu bed a", etc.
  if (text.includes('icu ward a') || text.includes('icu bed a') || text.includes('ward a')) {
    clinicianRoom = availableRooms.find((r) => r.id === 'RM-ICU-201' || r.name.includes('ICU-201'))?.name || 'ICU-201 (Bed A)';
  } else if (text.includes('icu ward b') || text.includes('icu bed b') || text.includes('ward b')) {
    clinicianRoom = availableRooms.find((r) => r.id === 'RM-ICU-202' || r.name.includes('ICU-202'))?.name || 'ICU-202 (Bed B)';
  } else if (text.includes('icu ward c') || text.includes('icu bed c') || text.includes('ward c')) {
    clinicianRoom = availableRooms.find((r) => r.id === 'RM-ICU-203' || r.name.includes('ICU-203'))?.name || 'ICU-203 (Bed C)';
  }

  if (!clinicianRoom) {
    for (const r of availableRooms) {
      const rNameLower = r.name.toLowerCase();
      const rIdLower = (r.id || '').toLowerCase();
      const rShort = rNameLower.split(' ')[0]; // e.g. "er-101"

      if (
        text.includes(rNameLower) ||
        (rIdLower && text.includes(rIdLower)) ||
        (rShort && text.includes(rShort))
      ) {
        clinicianRoom = r.name;
        break;
      }
    }
  }

  if (!clinicianRoom) {
    if (text.includes('trauma') || text.includes('er-101') || text.includes('emergency')) {
      clinicianRoom = availableRooms.find((r) => r.name.includes('ER-101'))?.name || availableRooms[0]?.name;
    } else if (text.includes('icu') || text.includes('intensive care')) {
      clinicianRoom = availableRooms.find((r) => r.name.includes('ICU'))?.name || availableRooms[0]?.name;
    } else if (text.includes('ot') || text.includes('theatre') || text.includes('surgery')) {
      clinicianRoom = availableRooms.find((r) => r.name.includes('OT'))?.name || availableRooms[0]?.name;
    } else {
      clinicianRoom = availableRooms[0]?.name || 'ER-101 (Trauma Bay 1)';
    }
  }

  const destinationRoom = clinicianRoom;

  // 3. Urgency Detection
  const isUrgent =
    text.includes('emergency') ||
    text.includes('urgent') ||
    text.includes('stat') ||
    text.includes('critical') ||
    text.includes('immediate') ||
    text.includes('code');

  const urgency = isUrgent ? 'urgent' : 'standard';

  // 4. Clinical Capabilities & Requirements
  const requiredCapabilities = [];
  if (text.includes('transport') || text.includes('mobile') || text.includes('portable')) {
    requiredCapabilities.push('Transport Ready');
  }
  if (text.includes('invasive') && !text.includes('non-invasive')) {
    requiredCapabilities.push('Invasive');
  }
  if (text.includes('non-invasive') || text.includes('bipap') || text.includes('cpap')) {
    requiredCapabilities.push('Non-Invasive');
  }
  if (text.includes('pediatric') || text.includes('child')) {
    requiredCapabilities.push('Pediatric');
  }
  if (text.includes('adult')) {
    requiredCapabilities.push('Adult');
  }
  if (text.includes('high flow') || text.includes('hfnc')) {
    requiredCapabilities.push('High Flow O2');
  }

  // 5. Minimum battery requirement if specified
  const batteryMatch = text.match(/(\d{1,3})\s*%\s*battery/);
  const minBatteryPercent = batteryMatch ? Math.min(100, Math.max(0, parseInt(batteryMatch[1], 10))) : null;

  // 6. Minimum runtime requirement in minutes
  let minRuntimeMinutes = null;
  const runtimeMatch =
    text.match(/(\d{1,4})\s*(?:min|mins|minute|minutes)\s*(?:of\s+)?(?:runtime|operating\s*time|battery\s*run-?time|duration)/i) ||
    text.match(/(?:need|require|minimum|at least|for)\s+(\d{1,4})\s*(?:min|mins|minute|minutes)(?:\s+(?:of\s+)?(?:runtime|battery|operating\s*time|duration))?/i) ||
    text.match(/(\d{1,4})\s*(?:min|mins|minute|minutes)\s+battery/i);

  if (runtimeMatch) {
    minRuntimeMinutes = parseInt(runtimeMatch[1], 10);
  }

  return {
    category,
    clinicianRoom,
    destinationRoom,
    urgency,
    requiredCapabilities,
    minBatteryPercent,
    minRuntimeMinutes,
  };
}

/**
 * Step A: Safety and eligibility filtering
 * Strictly excludes unavailable, quarantined, faulty, or maintenance-restricted assets.
 * Safety restrictions can NEVER be overridden by high battery or short distance.
 */
export function filterEligibleCandidates(
  equipmentList,
  {
    category,
    requiredCapabilities = [],
    minBatteryPercent = null,
    minRuntimeMinutes = null,
    activeMaintenanceEquipmentIds = new Set(),
  }
) {
  const eligible = [];
  const ineligible = [];

  for (const item of equipmentList) {
    // 1. Category check
    if (category && category !== 'All Categories' && item.category !== category) {
      ineligible.push({
        item,
        reason: `Category mismatch: Equipment is a ${item.category}, requested ${category}`,
        rule: 'CATEGORY_MISMATCH',
      });
      continue;
    }

    // 2. Active allocation / out-of-service status check
    if (item.status !== 'Available') {
      let detail = `Currently in status '${item.status}'`;
      if (item.status === 'In Use') {
        detail = `Currently in clinical use in ${item.currentRoom}`;
      } else if (item.status === 'Reserved') {
        detail = `Reserved by ${item.reservation?.department || 'another clinician'} until ${
          item.reservation?.expiresAt ? new Date(item.reservation.expiresAt).toLocaleTimeString() : 'expiry'
        }`;
      } else if (item.status === 'Faulty') {
        detail = `Hardware fault flagged. Locked from patient allocation`;
      } else if (item.status === 'Under Maintenance') {
        detail = `Under active biomedical service in workshop`;
      } else if (item.status === 'Sanitization Required') {
        detail = `Quarantined: Awaiting terminal disinfection`;
      }

      ineligible.push({
        item,
        reason: `Restricted: ${detail}`,
        rule: 'STATUS_UNAVAILABLE',
      });
      continue;
    }

    // 3. Sanitization & Infection Control Clearance
    if (item.sanitizationStatus === 'PENDING') {
      ineligible.push({
        item,
        reason: 'Restricted: Pending certified chemical disinfection and terminal sanitization.',
        rule: 'SANITIZATION_RESTRICTION',
      });
      continue;
    }

    // 4. Biomedical Maintenance Lockouts
    if (activeMaintenanceEquipmentIds.has(item.id)) {
      ineligible.push({
        item,
        reason: 'Restricted: Active maintenance ticket is open. Equipment release locked until signed off.',
        rule: 'MAINTENANCE_RESTRICTION',
      });
      continue;
    }

    // 5. Battery and verified runtime checks
    if (minBatteryPercent !== null && item.hasBattery) {
      if (item.batteryLevel !== null && item.batteryLevel < minBatteryPercent) {
        ineligible.push({
          item,
          reason: `Restricted: Current battery level (${item.batteryLevel}%) is below requested minimum (${minBatteryPercent}%).`,
          rule: 'BATTERY_INSUFFICIENT',
        });
        continue;
      }
    }

    if (minRuntimeMinutes !== null) {
      // Equipment without battery cannot satisfy an untethered runtime requirement
      if (!item.hasBattery) {
        ineligible.push({
          item,
          reason: `Restricted: Equipment is AC mains powered with no internal battery runtime; required minimum is ${minRuntimeMinutes} minutes.`,
          rule: 'RUNTIME_INSUFFICIENT',
        });
        continue;
      }

      const verifiedMinutes = item.batteryRuntime?.verifiedMinutes ?? item.verifiedRuntimeMinutes ?? null;
      const status = item.batteryRuntime?.verificationStatus || (verifiedMinutes !== null ? 'VERIFIED' : 'UNBENCHMARKED');
      const lastMeasuredAt = item.batteryRuntime?.lastMeasuredAt || null;
      const ageDays = lastMeasuredAt
        ? (Date.now() - new Date(lastMeasuredAt).getTime()) / (1000 * 3600 * 24)
        : null;

      // 5a. Stale calibration lockout (>90 days)
      if (status === 'STALE' || (ageDays !== null && ageDays > 90)) {
        ineligible.push({
          item,
          reason: `Restricted: Battery runtime benchmark is STALE (${ageDays !== null ? Math.round(ageDays) + ' days old' : 'calibration expired'}); cannot certify required ${minRuntimeMinutes} minutes.`,
          rule: 'RUNTIME_STALE',
        });
        continue;
      }

      // 5b. Unbenchmarked or missing telemetry lockout
      if (verifiedMinutes === null || verifiedMinutes === undefined || status === 'UNBENCHMARKED') {
        ineligible.push({
          item,
          reason: `Restricted: Verified battery operating runtime is unbenchmarked in registry; cannot guarantee required ${minRuntimeMinutes} minutes.`,
          rule: 'RUNTIME_UNVERIFIED',
        });
        continue;
      }

      // 5c. Insufficient verified runtime duration
      if (verifiedMinutes < minRuntimeMinutes) {
        ineligible.push({
          item,
          reason: `Restricted: Verified battery runtime (${verifiedMinutes}m) is below required task duration (${minRuntimeMinutes}m).`,
          rule: 'RUNTIME_INSUFFICIENT',
        });
        continue;
      }
    }

    // 6. Clinical Compatibility Requirements
    if (requiredCapabilities.length > 0) {
      const deviceCaps = (item.clinicalCapabilities || []).map((c) => c.toLowerCase());
      const missingCaps = requiredCapabilities.filter((c) => !deviceCaps.includes(c.toLowerCase()));

      // If equipment has explicitly defined capabilities and misses required ones
      if (item.clinicalCapabilities && item.clinicalCapabilities.length > 0 && missingCaps.length > 0) {
        ineligible.push({
          item,
          reason: `Incompatible: Lacks required capabilities (${missingCaps.join(', ')}).`,
          rule: 'COMPATIBILITY_UNSATISFIED',
        });
        continue;
      }
    }

    eligible.push(item);
  }

  return { eligible, ineligible };
}

/**
 * Calculates modeled indoor navigation route, distance, & transit time between hospital rooms.
 * Uses hospital architectural graph with Dijkstra shortest-path routing, corridors,
 * and vertical elevator shafts.
 */
export function calculateTransit(equipmentRoomName, destinationRoomName, roomsList = [], graphOptions = {}) {
  const disclaimer =
    'Architectural floor-plan route estimate based on last confirmed dual-QR scan. Never represents real-time physical or RTLS tracking.';

  if (!equipmentRoomName) {
    const route = {
      isNavigable: false,
      unreachableReason: 'Equipment location record is missing or null in the database registry.',
      fromRoom: null,
      toRoom: destinationRoomName || null,
      totalDistanceMeters: null,
      estimatedTransitMinutes: null,
      floorChanges: null,
      hasElevatorTransfer: false,
      steps: [],
      path: [],
      disclaimer,
    };
    return {
      minutes: null,
      meters: null,
      label: 'Equipment location missing',
      basis: 'Equipment location record is missing from the database.',
      isEstimate: true,
      isReachable: false,
      tier: 'unknown',
      route,
    };
  }

  if (!destinationRoomName) {
    const route = {
      isNavigable: false,
      unreachableReason: 'Clinician target room is unspecified.',
      fromRoom: equipmentRoomName,
      toRoom: null,
      totalDistanceMeters: null,
      estimatedTransitMinutes: null,
      floorChanges: null,
      hasElevatorTransfer: false,
      steps: [],
      path: [],
      disclaimer,
    };
    return {
      minutes: null,
      meters: null,
      label: 'Target room unspecified',
      basis: 'Clinician / destination room was not provided.',
      isEstimate: true,
      isReachable: false,
      tier: 'unknown',
      route,
    };
  }

  const route = findShortestRoute(equipmentRoomName, destinationRoomName, graphOptions);

  if (equipmentRoomName === destinationRoomName) {
    return {
      minutes: 0,
      meters: 0,
      label: 'Immediate Bedside (Same Room)',
      basis: 'Equipment is currently confirmed in the clinician target room.',
      isEstimate: false,
      isReachable: true,
      tier: 'immediate',
      route,
    };
  }

  if (!route.isNavigable) {
    return {
      minutes: null,
      meters: null,
      label: route.unreachableReason || 'Unmodeled room route',
      basis: route.unreachableReason || 'Room metadata is missing from the hospital registry. Route estimate unavailable.',
      isEstimate: true,
      isReachable: false,
      tier: 'unknown',
      route,
    };
  }

  const fromRoom = roomsList.find((r) => r.name === equipmentRoomName || r.id === equipmentRoomName);
  const toRoom = roomsList.find((r) => r.name === destinationRoomName || r.id === destinationRoomName);

  // If room metadata isn't in roomsList, deduce from route path directly
  const fromFloor = fromRoom?.floor || route.path[0]?.floor || 'Floor 1';
  const toFloor = toRoom?.floor || route.path[route.path.length - 1]?.floor || 'Floor 1';
  const fromWing = fromRoom?.wing || route.path[0]?.wing || 'Central';
  const toWing = toRoom?.wing || route.path[route.path.length - 1]?.wing || 'Central';

  // Same Floor Transit
  if (fromFloor === toFloor) {
    if (fromWing === toWing) {
      return {
        minutes: 1.0,
        meters: route.totalDistanceMeters || 25,
        label: `~1 min (${toFloor}, ${toWing} • ${route.totalDistanceMeters || 25}m)`,
        basis: `Same floor (${fromFloor}) and adjacent corridor (${fromWing}). Shortest route: ${route.totalDistanceMeters || 25}m.`,
        isEstimate: true,
        isReachable: true,
        tier: 'close',
        route,
      };
    } else {
      return {
        minutes: 2.5,
        meters: route.totalDistanceMeters || 55,
        label: `~2.5 mins (${toFloor}, ${fromWing} → ${toWing} • ${route.totalDistanceMeters || 55}m)`,
        basis: `Same floor (${fromFloor}), cross-wing transit from ${fromWing} to ${toWing}. Shortest route: ${route.totalDistanceMeters || 55}m.`,
        isEstimate: true,
        isReachable: true,
        tier: 'medium',
        route,
      };
    }
  }

  // Different Floors Transit (Vertical Elevator Core required)
  const fromLevel = FLOOR_LEVEL_INDEX[fromFloor] ?? 1;
  const toLevel = FLOOR_LEVEL_INDEX[toFloor] ?? 1;
  const floorDifference = route.floorChanges || Math.abs(fromLevel - toLevel);
  const estimatedMinutes = Math.min(6.5, 2.0 + floorDifference * 1.5);
  const estimatedMeters = route.totalDistanceMeters || (50 + floorDifference * 30);
  const elevatorName = route.elevatorUsed || 'Central Bed Elevator';

  return {
    minutes: estimatedMinutes,
    meters: estimatedMeters,
    label: `~${estimatedMinutes} mins (${fromFloor} → ${toFloor} • ${estimatedMeters}m via ${elevatorName})`,
    basis: `Vertical transit across ${floorDifference} floor(s) via ${elevatorName}. Shortest route: ${estimatedMeters}m.`,
    isEstimate: true,
    isReachable: true,
    tier: 'distant',
    route,
  };
}

/**
 * Step B: Calculate transparent, normalized ranking scores
 */
export function rankCandidates(
  eligibleCandidates = [],
  options = {}
) {
  const {
    destinationRoomName,
    destinationRoom,
    clinicianRoom,
    roomsList = [],
    rooms = [],
    urgency = 'urgent',
    requiredCapabilities = [],
    graphOptions = {},
  } = options;

  const targetLocation = clinicianRoom || destinationRoomName || destinationRoom;
  const targetRooms = roomsList.length > 0 ? roomsList : rooms;
  const candidatesArray = Array.isArray(eligibleCandidates)
    ? eligibleCandidates
    : (eligibleCandidates?.eligible || []);
  const weights = SCORING_WEIGHTS[urgency] || SCORING_WEIGHTS.urgent;

  const scoredCandidates = candidatesArray.map((item) => {
    const transit = calculateTransit(item.currentRoom, targetLocation, targetRooms, graphOptions);
    const disclosedLimitations = [];

    // 1. Battery Suitability & Runtime Score (0 to 100)
    let batteryScore = 50;
    let batteryStatusNote = 'AC Mains / No battery';
    let runtimeDisclosed = false;
    let runtimeWarning = null;

    const verifiedMinutes = item.batteryRuntime?.verifiedMinutes ?? item.verifiedRuntimeMinutes ?? null;
    const verificationStatus = item.batteryRuntime?.verificationStatus || (verifiedMinutes !== null ? 'VERIFIED' : 'UNBENCHMARKED');
    const runtimeSource = item.batteryRuntime?.source || (verifiedMinutes !== null ? 'BIOMED_LOAD_TEST' : 'UNVERIFIED');
    const lastMeasuredAt = item.batteryRuntime?.lastMeasuredAt || null;
    const runtimeAgeDays = lastMeasuredAt
      ? Math.floor((Date.now() - new Date(lastMeasuredAt).getTime()) / (1000 * 3600 * 24))
      : null;
    const isStale = verificationStatus === 'STALE' || (runtimeAgeDays !== null && runtimeAgeDays > 90);

    if (item.hasBattery) {
      if (verifiedMinutes !== null && verifiedMinutes !== undefined) {
        runtimeDisclosed = true;
        // Benchmark: 240 mins (4 hours) typical high-readiness target
        const runtimeRatio = Math.min(100, Math.max(10, Math.round((verifiedMinutes / 240) * 100)));

        if (item.batteryLevel !== null && item.batteryLevel !== undefined) {
          batteryScore = Math.round(0.70 * runtimeRatio + 0.30 * item.batteryLevel);
        } else {
          batteryScore = runtimeRatio;
        }

        // Apply quality & verification source modifiers
        if (runtimeSource === 'BIOMED_LOAD_TEST' || runtimeSource === 'OEM_BENCHMARK') {
          batteryScore = Math.min(100, batteryScore + 3);
        }

        if (isStale) {
          batteryScore = Math.max(15, batteryScore - 15);
          runtimeWarning = 'STALE_BENCHMARK';
          disclosedLimitations.push(
            `Battery runtime calibration is STALE (${runtimeAgeDays !== null ? runtimeAgeDays + 'd' : '>90d'} old); physical biomed re-benchmarking required.`
          );
        } else if (verificationStatus === 'ESTIMATED' || runtimeSource === 'TELEMETRY_ESTIMATE') {
          batteryScore = Math.min(75, batteryScore);
          runtimeWarning = 'ESTIMATED_RUNTIME';
          disclosedLimitations.push(
            'Battery runtime is an unverified estimate, not a certified clinical benchmark.'
          );
        }

        batteryStatusNote = `${verifiedMinutes}m verified runtime (${item.batteryLevel !== null ? item.batteryLevel + '%' : 'unmonitored'} charge)`;
      } else if (item.batteryLevel !== null && item.batteryLevel !== undefined) {
        // Percentage fallback
        batteryScore = Math.min(100, Math.max(5, item.batteryLevel));
        batteryStatusNote = `${item.batteryLevel}% charge (verified runtime unbenchmarked)`;
        runtimeWarning = 'UNVERIFIED_RUNTIME';
        disclosedLimitations.push(
          'Verified battery runtime duration is not logged in the registry; score is calculated from raw percentage charge.'
        );
      } else {
        batteryScore = 40;
        batteryStatusNote = 'Battery installed, charge level unmonitored';
        runtimeWarning = 'MISSING_TELEMETRY';
        disclosedLimitations.push('Battery charge reading is unconfirmed in equipment record.');
      }
    } else {
      batteryScore = 75; // AC equipment with no internal battery need
    }

    // 2. Route-Based Distance & Delivery Transit Score (0 to 100)
    // CRITICAL: Unreachable equipment receives distanceScore = 0 and is flagged
    let distanceScore = 0;
    const isNavigable = transit.route?.isNavigable === true;

    if (!isNavigable) {
      distanceScore = 0;
      disclosedLimitations.push(
        `Route unreachable: ${transit.route?.unreachableReason || 'Destination is unreachable from current equipment location.'}`
      );
    } else if (transit.minutes !== null) {
      if (transit.minutes === 0) {
        distanceScore = 100;
      } else if (transit.minutes <= 1.0) {
        distanceScore = 90;
      } else if (transit.minutes <= 2.5) {
        distanceScore = 75;
      } else if (transit.minutes <= 4.0) {
        distanceScore = 55;
      } else {
        distanceScore = Math.max(20, Math.round(100 - transit.minutes * 15));
      }
    } else {
      distanceScore = 0;
      disclosedLimitations.push('Room transit route is unmodeled; route estimate unavailable.');
    }

    if (transit.isEstimate && transit.minutes !== 0 && isNavigable) {
      disclosedLimitations.push('Transit duration is a floor-plan estimate; actual transit may vary with elevator availability.');
    }

    // 3. Operational Readiness & Health Score (0 to 100)
    let readinessScore = 100;

    // Condition deduction
    if (item.condition === 'Good') readinessScore -= 10;
    else if (item.condition === 'Fair') readinessScore -= 25;

    // Operating hours wear deduction
    if (item.operatingHours > 2500) readinessScore -= 15;
    else if (item.operatingHours > 1500) readinessScore -= 8;

    // Location Freshness & Staleness Analysis
    const confirmedTime = item.lastConfirmedAt || item.locationConfirmedAt || null;
    const hoursSinceConfirmed = confirmedTime
      ? (Date.now() - new Date(confirmedTime).getTime()) / (1000 * 3600)
      : null;

    let locationFreshness = 'FRESH';
    let locationWarning = null;

    if (!item.currentRoom) {
      locationFreshness = 'MISSING';
      locationWarning = 'MISSING_LOCATION';
      readinessScore -= 30;
      disclosedLimitations.push('Equipment location record is missing in the database registry.');
    } else if (!isNavigable && transit.route?.unreachableReason?.includes('not registered')) {
      locationFreshness = 'UNMODELED';
      locationWarning = 'UNMODELED_LOCATION';
      readinessScore -= 20;
      disclosedLimitations.push(`Recorded location '${item.currentRoom}' is not mapped in the hospital floor-plan graph.`);
    } else if (hoursSinceConfirmed === null || hoursSinceConfirmed === undefined) {
      locationFreshness = 'UNVERIFIED';
      locationWarning = 'UNVERIFIED_LOCATION';
      readinessScore -= 15;
      disclosedLimitations.push('Location confirmation timestamp is unverified; physical check required before dispatch.');
    } else if (hoursSinceConfirmed > 24) {
      locationFreshness = 'STALE';
      locationWarning = 'STALE_LOCATION';
      readinessScore -= 15;
      disclosedLimitations.push(
        `Physical location was confirmed ${Math.round(hoursSinceConfirmed)}h ago; physical presence verification recommended before dispatch.`
      );
    } else if (hoursSinceConfirmed > 6) {
      locationFreshness = 'MODERATE';
    }

    readinessScore = Math.min(100, Math.max(15, readinessScore));

    // 4. Clinical Compatibility Score (0 to 100)
    let compatibilityScore = 100;
    if (requiredCapabilities.length > 0) {
      const deviceCaps = (item.clinicalCapabilities || []).map((c) => c.toLowerCase());
      const matched = requiredCapabilities.filter((c) => deviceCaps.includes(c.toLowerCase())).length;
      compatibilityScore = Math.round((matched / requiredCapabilities.length) * 100);
      if (item.clinicalCapabilities?.length === 0) {
        disclosedLimitations.push('Specific clinical capability flags are unbenchmarked in this device profile.');
      }
    }

    // Weighted Overall Score Calculation
    const overallScore = Math.round(
      weights.distance * distanceScore +
        weights.battery * batteryScore +
        weights.readiness * readinessScore +
        weights.compatibility * compatibilityScore
    );

    return {
      equipment: item,
      overallScore: Math.min(100, Math.max(5, overallScore)),
      score: Math.min(100, Math.max(5, overallScore)),
      subscores: {
        distance: distanceScore,
        battery: batteryScore,
        readiness: readinessScore,
        compatibility: compatibilityScore,
      },
      metrics: {
        batteryLevel: item.batteryLevel,
        batteryPercent: item.batteryLevel,
        hasBattery: item.hasBattery,
        verifiedRuntimeMinutes: verifiedMinutes,
        runtimeMinutes: verifiedMinutes,
        runtimeDisclosed,
        batteryStatusNote,
        // Battery Runtime Intelligence & Telemetry fields
        runtimeStatus: verificationStatus,
        runtimeSource,
        runtimeAgeDays,
        lastMeasuredAt,
        runtimeWarning,
        testLoadProfile: item.batteryRuntime?.testLoadProfile || null,
        verifiedBy: item.batteryRuntime?.verifiedBy || null,
        // Indoor Navigation intelligence
        transitMinutes: transit.minutes,
        transitMeters: transit.meters,
        transitLabel: transit.label,
        transitBasis: transit.basis,
        transitTier: transit.tier,
        condition: item.condition,
        operatingHours: item.operatingHours,
        currentRoom: item.currentRoom,
        sanitizationStatus: item.sanitizationStatus,
        floorChanges: transit.route?.floorChanges ?? 0,
        hasElevatorTransfer: transit.route?.hasElevatorTransfer ?? false,
        elevatorUsed: transit.route?.elevatorUsed ?? null,
        routeSteps: transit.route?.steps ?? [],
        routePath: transit.route?.path ?? [],
        routeNavigable: isNavigable,
        isReachable: isNavigable,
        unreachableReason: transit.route?.unreachableReason ?? null,
        routeDisclaimer: transit.route?.disclaimer ?? 'Architectural floor-plan route estimate based on last confirmed dual-QR scan. Never represents real-time physical tracking.',
        // Location Freshness Tracking
        locationFreshness,
        locationWarning,
        locationAgeHours: hoursSinceConfirmed !== null ? Math.round(hoursSinceConfirmed * 10) / 10 : null,
        lastConfirmedAt: item.lastConfirmedAt || null,
        lastConfirmedBy: item.lastConfirmedBy || 'System Registry',
      },
      disclosedLimitations,
    };
  });

  // Sort descending by overall recommendation score with deterministic tie-breakers:
  // 0. Reachability Priority: Reachable candidates ALWAYS outrank unreachable candidates
  // 1. Overall score
  // 2. Verified runtime status (VERIFIED > UNBENCHMARKED / STALE)
  // 3. Verified runtime duration
  // 4. Battery percentage
  // 5. Shortest transit meters
  scoredCandidates.sort((a, b) => {
    const aReachable = a.metrics.routeNavigable === true;
    const bReachable = b.metrics.routeNavigable === true;
    if (aReachable !== bReachable) {
      return aReachable ? -1 : 1;
    }

    if (b.overallScore !== a.overallScore) {
      return b.overallScore - a.overallScore;
    }
    const aVerified = a.metrics.runtimeStatus === 'VERIFIED';
    const bVerified = b.metrics.runtimeStatus === 'VERIFIED';
    if (aVerified !== bVerified) {
      return aVerified ? -1 : 1;
    }
    const aMins = a.metrics.verifiedRuntimeMinutes || 0;
    const bMins = b.metrics.verifiedRuntimeMinutes || 0;
    if (bMins !== aMins) {
      return bMins - aMins;
    }
    const aBat = a.metrics.batteryLevel || 0;
    const bBat = b.metrics.batteryLevel || 0;
    if (bBat !== aBat) {
      return bBat - aBat;
    }
    const aDist = a.metrics.transitMeters ?? 9999;
    const bDist = b.metrics.transitMeters ?? 9999;
    return aDist - bDist;
  });

  // Assign ranks
  return scoredCandidates.map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
  }));
}

/**
 * Phase 3: AI Explanation Layer (Deterministic clinical rationale generator)
 * Translates real candidate metrics into actionable, clinical decision-support rationale.
 * NEVER hallucinates data or declares unverified equipment safe.
 */
export function generateClinicalExplanation(rankedCandidates, queryContext) {
  if (!rankedCandidates || rankedCandidates.length === 0) {
    return {
      summary: `No available ${queryContext.category || 'equipment'} met clinical safety and eligibility criteria.`,
      keyFinding: 'All inventory assets in this category are currently allocated, undergoing maintenance, or awaiting sanitization.',
      candidateRationales: [],
      comparativeAnalysis: 'No candidates were eligible for comparative ranking.',
    };
  }

  const top = rankedCandidates[0];
  const second = rankedCandidates[1];
  const dest = queryContext.clinicianRoom || queryContext.destinationRoom || 'the target clinical unit';

  let keyFinding = `${top.equipment.name} (${top.equipment.id}) ranks #1 with a recommendation score of ${top.overallScore}/100. `;

  if (top.metrics.transitMinutes === 0) {
    keyFinding += `It is already confirmed in the same room (${top.equipment.currentRoom}), eliminating transfer transit time. `;
  } else if (top.metrics.transitMinutes !== null) {
    const floorInfo = top.metrics.floorChanges > 0
      ? `across ${top.metrics.floorChanges} floor(s) via ${top.metrics.elevatorUsed || 'Central Bed Elevator'}`
      : 'on the same floor';
    keyFinding += `Shortest indoor route from ${top.equipment.currentRoom} is ${top.metrics.transitMeters}m (${floorInfo}, est. ~${top.metrics.transitMinutes} mins). `;
  }

  if (top.metrics.hasBattery) {
    if (top.metrics.runtimeStatus === 'VERIFIED' && top.metrics.verifiedRuntimeMinutes) {
      keyFinding += `Verified battery runtime is ${top.metrics.verifiedRuntimeMinutes} minutes. `;
    } else if (top.metrics.runtimeStatus === 'STALE') {
      keyFinding += `Battery charge is ${top.metrics.batteryLevel}%, but runtime calibration is STALE (${top.metrics.runtimeAgeDays}d ago). `;
    } else if (top.metrics.batteryLevel !== null) {
      keyFinding += `Battery charge is ${top.metrics.batteryLevel}%. `;
    }
  }

  // Comparative analysis between top and second
  let comparativeAnalysis = '';
  if (second) {
    const timeDiff =
      top.metrics.transitMinutes !== null && second.metrics.transitMinutes !== null
        ? Math.round((second.metrics.transitMinutes - top.metrics.transitMinutes) * 10) / 10
        : null;

    const runtimeDiff =
      top.metrics.verifiedRuntimeMinutes && second.metrics.verifiedRuntimeMinutes
        ? top.metrics.verifiedRuntimeMinutes - second.metrics.verifiedRuntimeMinutes
        : null;

    const batteryDiff =
      top.metrics.batteryLevel !== null && second.metrics.batteryLevel !== null
        ? top.metrics.batteryLevel - second.metrics.batteryLevel
        : null;

    if (timeDiff !== null && timeDiff > 0) {
      comparativeAnalysis = `${top.equipment.name} outranks ${second.equipment.name} (#2) primarily due to ~${timeDiff} min faster transit to ${dest} (${top.equipment.currentRoom} vs ${second.equipment.currentRoom}).`;
    } else if (top.metrics.runtimeStatus === 'VERIFIED' && second.metrics.runtimeStatus !== 'VERIFIED') {
      comparativeAnalysis = `${top.equipment.name} outranks ${second.equipment.name} (#2) due to certified battery runtime benchmark (${top.metrics.verifiedRuntimeMinutes}m) vs unbenchmarked status.`;
    } else if (runtimeDiff !== null && runtimeDiff > 0) {
      comparativeAnalysis = `${top.equipment.name} outranks ${second.equipment.name} (#2) primarily due to longer verified runtime (${top.metrics.verifiedRuntimeMinutes}m vs ${second.metrics.verifiedRuntimeMinutes}m).`;
    } else if (batteryDiff !== null && batteryDiff > 0) {
      comparativeAnalysis = `${top.equipment.name} outranks ${second.equipment.name} (#2) primarily due to a superior battery charge (${top.metrics.batteryLevel}% vs ${second.metrics.batteryLevel}%).`;
    } else {
      comparativeAnalysis = `${top.equipment.name} outranks ${second.equipment.name} (#2) based on operational readiness (${top.metrics.condition} condition, ${top.metrics.operatingHours} operating hours).`;
    }
  } else {
    comparativeAnalysis = `${top.equipment.name} is the sole eligible candidate in active inventory that meets all sanitization and safety criteria.`;
  }

  // Individual candidate rationales
  const candidateRationales = rankedCandidates.map((c) => {
    let text = `Rank #${c.rank}: ${c.equipment.name} (${c.equipment.id}) — Score ${c.overallScore}/100. `;
    text += `Location: ${c.equipment.currentRoom} (${c.metrics.transitLabel}). `;
    if (c.metrics.hasBattery) {
      text += `Power: ${c.metrics.batteryStatusNote}. `;
    }
    text += `Condition: ${c.metrics.condition} (${c.metrics.operatingHours}h runtime). `;
    if (c.disclosedLimitations.length > 0) {
      text += `Note: ${c.disclosedLimitations[0]}`;
    }
    return {
      equipmentId: c.equipment.id,
      rank: c.rank,
      overallScore: c.overallScore,
      rationale: text.trim(),
    };
  });

  return {
    summary: `Top recommendation: ${top.equipment.name} (${top.equipment.id}) for delivery to ${dest}.`,
    keyFinding,
    comparativeAnalysis,
    candidateRationales,
  };
}

/**
 * Optional LLM synthesis: Calls external LLM (Gemini or OpenAI) if API keys are configured.
 * Strictly constrained by the pre-computed candidate facts.
 */
export async function synthesizeLLMExplanation(rankedCandidates, queryContext, deterministicExplanation) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!geminiKey && !openaiKey) {
    // Return deterministic explanation directly when no API key is provided
    return {
      provider: 'deterministic-rules-engine',
      explanation: deterministicExplanation,
    };
  }

  // Prepare constrained prompt containing only factual data
  const candidateSummary = rankedCandidates.slice(0, 3).map((c) => ({
    rank: c.rank,
    id: c.equipment.id,
    name: c.equipment.name,
    model: c.equipment.model,
    room: c.equipment.currentRoom,
    score: c.overallScore,
    transitTimeMinutes: c.metrics.transitMinutes,
    batteryPercent: c.metrics.batteryLevel,
    verifiedRuntimeMinutes: c.metrics.verifiedRuntimeMinutes,
    condition: c.metrics.condition,
    limitations: c.disclosedLimitations,
  }));

  const systemInstructions = `You are the SmartMed Clinical Decision Support AI Assistant.
Explain the equipment recommendation results to clinical staff.
STRICT SAFETY RULES:
1. NEVER invent equipment IDs, battery readings, or room locations.
2. NEVER override the eligibility filters or declare restricted equipment safe.
3. Reference ONLY the provided candidates: ${JSON.stringify(candidateSummary)}.
4. Clearly state why Rank 1 is preferable over Rank 2 based on delivery time, battery, or location.
5. Disclose if battery runtime is unbenchmarked or transit is an architectural estimate.
6. Provide a concise, professional 2-3 paragraph clinical decision support summary.`;

  try {
    if (geminiKey) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemInstructions}\n\nClinical Query: "${queryContext.prompt || 'Recommend best equipment'}"` }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 500,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (generatedText && generatedText.trim().length > 0) {
          return {
            provider: 'gemini-1.5-flash',
            explanation: {
              ...deterministicExplanation,
              llmSynthesis: generatedText.trim(),
            },
          };
        }
      }
    }
  } catch (err) {
    console.warn('[SmartMed AI Engine] LLM generation skipped or failed:', err.message);
  }

  // Graceful fallback to deterministic explanation
  return {
    provider: 'deterministic-rules-engine',
    explanation: deterministicExplanation,
  };
}
