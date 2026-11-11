/**
 * SmartMed Indoor Navigation and Hospital Distance Intelligence Service
 *
 * Implements a weighted architectural graph of hospital rooms, corridors,
 * intersections, and vertical elevator shafts across all floors.
 *
 * Uses Dijkstra's shortest-path algorithm to calculate valid routes,
 * precise transit distances (meters), elevator transitions, and estimated
 * equipment transport times.
 *
 * SAFETY INVARIANT: All routes and times are deterministic architectural floor-plan
 * estimates based on the last confirmed room QR scan. NEVER represents live GPS/RTLS tracking.
 */

// Floor index mapping
export const FLOOR_LEVELS = {
  'Basement 1': 0,
  'Floor 1': 1,
  'Floor 2': 2,
  'Floor 3': 3,
};

// Standard equipment transport speed pushing biomedical cart: ~0.9 meters / second (54 m/min)
export const TRANSIT_SPEED_METERS_PER_SEC = 0.9;

// Elevator cycle times: 30s base door open/close cycle + 15s per floor traveled
export const ELEVATOR_BASE_CYCLE_SECONDS = 30;
export const ELEVATOR_PER_FLOOR_SECONDS = 15;
export const ELEVATOR_VERTICAL_METERS_PER_FLOOR = 4.0;

/**
 * Standard hospital architectural navigation graph nodes.
 * Accurately models rooms from the active MongoDB Room registry along with
 * interconnecting corridors, central junction hubs, and elevator banks.
 */
export const HOSPITAL_NODES = [
  // --- FLOOR 1: EMERGENCY, TRAUMA & DIAGNOSTICS ---
  {
    id: 'RM-ER-101',
    roomCode: 'RM-ER-101',
    name: 'ER-101 (Trauma Bay 1)',
    type: 'room',
    floor: 'Floor 1',
    wing: 'East Wing',
    level: 1,
    department: 'Emergency Medicine',
  },
  {
    id: 'RM-ER-102',
    roomCode: 'RM-ER-102',
    name: 'ER-102 (Acute Resus)',
    type: 'room',
    floor: 'Floor 1',
    wing: 'East Wing',
    level: 1,
    department: 'Emergency Medicine',
  },
  {
    id: 'RM-ER-103',
    roomCode: 'RM-ER-103',
    name: 'ER-103 (Triage & Rapid Assessment)',
    type: 'room',
    floor: 'Floor 1',
    wing: 'East Wing',
    level: 1,
    department: 'Emergency Medicine',
  },
  {
    id: 'RM-ER-104',
    roomCode: 'RM-ER-104',
    name: 'ER-104 (Pediatric Emergency)',
    type: 'room',
    floor: 'Floor 1',
    wing: 'East Wing',
    level: 1,
    department: 'Pediatric Emergency',
  },
  {
    id: 'COR-F1-EAST',
    name: 'Floor 1 East Emergency Corridor',
    type: 'corridor',
    floor: 'Floor 1',
    wing: 'East Wing',
    level: 1,
  },
  {
    id: 'RM-RAD-101',
    roomCode: 'RM-RAD-101',
    name: 'Radiology & CT Diagnostic Suite 101',
    type: 'room',
    floor: 'Floor 1',
    wing: 'West Wing',
    level: 1,
    department: 'Diagnostic Imaging',
  },
  {
    id: 'COR-F1-WEST',
    name: 'Floor 1 West Diagnostic Corridor',
    type: 'corridor',
    floor: 'Floor 1',
    wing: 'West Wing',
    level: 1,
  },
  {
    id: 'RM-STOR-F1',
    roomCode: 'RM-STOR-F1',
    name: 'Floor 1 Rapid Equipment Depot',
    type: 'storage',
    floor: 'Floor 1',
    wing: 'Central Block',
    level: 1,
    department: 'Asset Logistics',
  },
  {
    id: 'INT-F1-CENTRAL',
    name: 'Floor 1 Central Junction Hub',
    type: 'intersection',
    floor: 'Floor 1',
    wing: 'Central Block',
    level: 1,
  },
  {
    id: 'ELEV-01-F1',
    name: 'Central Bed Elevator Lobby (Floor 1)',
    type: 'elevator',
    floor: 'Floor 1',
    wing: 'Central Block',
    level: 1,
    elevatorId: 'ELEV-01',
  },

  // --- FLOOR 2: CRITICAL CARE / ICU & SPECIALTY UNITS ---
  {
    id: 'RM-ICU-201',
    roomCode: 'RM-ICU-201',
    name: 'ICU-201 (Bed A)',
    type: 'room',
    floor: 'Floor 2',
    wing: 'North Wing',
    level: 2,
    department: 'Intensive Care Unit',
  },
  {
    id: 'RM-ICU-202',
    roomCode: 'RM-ICU-202',
    name: 'ICU-202 (Bed B)',
    type: 'room',
    floor: 'Floor 2',
    wing: 'North Wing',
    level: 2,
    department: 'Intensive Care Unit',
  },
  {
    id: 'RM-ICU-203',
    roomCode: 'RM-ICU-203',
    name: 'ICU-203 (Bed C)',
    type: 'room',
    floor: 'Floor 2',
    wing: 'North Wing',
    level: 2,
    department: 'Intensive Care Unit',
  },
  {
    id: 'RM-ICU-204',
    roomCode: 'RM-ICU-204',
    name: 'ICU-204 (Negative Pressure Isolation)',
    type: 'room',
    floor: 'Floor 2',
    wing: 'North Wing',
    level: 2,
    department: 'Intensive Care Unit',
  },
  {
    id: 'COR-F2-NORTH',
    name: 'Floor 2 North ICU Corridor',
    type: 'corridor',
    floor: 'Floor 2',
    wing: 'North Wing',
    level: 2,
  },
  {
    id: 'RM-NICU-205',
    roomCode: 'RM-NICU-205',
    name: 'Neonatal ICU 205',
    type: 'room',
    floor: 'Floor 2',
    wing: 'South Wing',
    level: 2,
    department: 'Neonatal Intensive Care',
  },
  {
    id: 'RM-CCU-206',
    roomCode: 'RM-CCU-206',
    name: 'Cardiac Care Unit 206',
    type: 'room',
    floor: 'Floor 2',
    wing: 'South Wing',
    level: 2,
    department: 'Cardiovascular Care',
  },
  {
    id: 'COR-F2-SOUTH',
    name: 'Floor 2 South Critical Care Corridor',
    type: 'corridor',
    floor: 'Floor 2',
    wing: 'South Wing',
    level: 2,
  },
  {
    id: 'RM-STOR-F2',
    roomCode: 'RM-STOR-F2',
    name: 'Floor 2 Critical Care Equipment Depot',
    type: 'storage',
    floor: 'Floor 2',
    wing: 'Central Block',
    level: 2,
    department: 'Critical Care Logistics',
  },
  {
    id: 'INT-F2-CENTRAL',
    name: 'Floor 2 Central Junction Hub',
    type: 'intersection',
    floor: 'Floor 2',
    wing: 'Central Block',
    level: 2,
  },
  {
    id: 'ELEV-01-F2',
    name: 'Central Bed Elevator Lobby (Floor 2)',
    type: 'elevator',
    floor: 'Floor 2',
    wing: 'Central Block',
    level: 2,
    elevatorId: 'ELEV-01',
  },

  // --- FLOOR 3: SURGICAL THEATRES, PACU & RECOVERY WARDS ---
  {
    id: 'RM-OT-01',
    roomCode: 'RM-OT-01',
    name: 'OT-1 (General Surgery Suite)',
    type: 'room',
    floor: 'Floor 3',
    wing: 'Central Block',
    level: 3,
    department: 'Surgical Services',
  },
  {
    id: 'RM-OT-02',
    roomCode: 'RM-OT-02',
    name: 'OT-2 (Cardiothoracic Theatre)',
    type: 'room',
    floor: 'Floor 3',
    wing: 'Central Block',
    level: 3,
    department: 'Surgical Services',
  },
  {
    id: 'RM-OT-03',
    roomCode: 'RM-OT-03',
    name: 'OT-3 (Orthopedic & Trauma Theatre)',
    type: 'room',
    floor: 'Floor 3',
    wing: 'Central Block',
    level: 3,
    department: 'Surgical Services',
  },
  {
    id: 'RM-PACU-01',
    roomCode: 'RM-PACU-01',
    name: 'PACU (Post-Anesthesia Care Unit)',
    type: 'room',
    floor: 'Floor 3',
    wing: 'Central Block',
    level: 3,
    department: 'Post-Anesthesia Care',
  },
  {
    id: 'COR-F3-CENTRAL',
    name: 'Floor 3 Central Surgical Corridor',
    type: 'corridor',
    floor: 'Floor 3',
    wing: 'Central Block',
    level: 3,
  },
  {
    id: 'RM-W3A-05',
    roomCode: 'RM-W3A-05',
    name: 'Ward 3A (Room 305)',
    type: 'room',
    floor: 'Floor 3',
    wing: 'West Wing',
    level: 3,
    department: 'Internal Medicine',
  },
  {
    id: 'RM-W3B-12',
    roomCode: 'RM-W3B-12',
    name: 'Ward 3B (Room 312)',
    type: 'room',
    floor: 'Floor 3',
    wing: 'West Wing',
    level: 3,
    department: 'Post-Surgical Recovery',
  },
  {
    id: 'RM-W3C-20',
    roomCode: 'RM-W3C-20',
    name: 'Ward 3C (Step-Down Unit 320)',
    type: 'room',
    floor: 'Floor 3',
    wing: 'West Wing',
    level: 3,
    department: 'Step-Down Care',
  },
  {
    id: 'COR-F3-WEST',
    name: 'Floor 3 West Inpatient Corridor',
    type: 'corridor',
    floor: 'Floor 3',
    wing: 'West Wing',
    level: 3,
  },
  {
    id: 'RM-STOR-F3',
    roomCode: 'RM-STOR-F3',
    name: 'Floor 3 Surgical Supply Depot',
    type: 'storage',
    floor: 'Floor 3',
    wing: 'Central Block',
    level: 3,
    department: 'Surgical Logistics',
  },
  {
    id: 'INT-F3-CENTRAL',
    name: 'Floor 3 Central Junction Hub',
    type: 'intersection',
    floor: 'Floor 3',
    wing: 'Central Block',
    level: 3,
  },
  {
    id: 'ELEV-01-F3',
    name: 'Central Bed Elevator Lobby (Floor 3)',
    type: 'elevator',
    floor: 'Floor 3',
    wing: 'Central Block',
    level: 3,
    elevatorId: 'ELEV-01',
  },

  // --- BASEMENT 1: BIOMEDICAL ENGINEERING, DECON & CENTRAL STORAGE ---
  {
    id: 'RM-BIOMED-B1',
    roomCode: 'RM-BIOMED-B1',
    name: 'Biomedical Workshop B1',
    type: 'room',
    floor: 'Basement 1',
    wing: 'Service Core',
    level: 0,
    department: 'Biomedical Engineering',
  },
  {
    id: 'RM-SAN-BAY',
    roomCode: 'RM-SAN-BAY',
    name: 'Central Sanitization & Decon Bay',
    type: 'room',
    floor: 'Basement 1',
    wing: 'Service Core',
    level: 0,
    department: 'Infection Prevention',
  },
  {
    id: 'RM-STOR-B1',
    roomCode: 'RM-STOR-B1',
    name: 'Central Clean Storage Warehouse',
    type: 'storage',
    floor: 'Basement 1',
    wing: 'Service Core',
    level: 0,
    department: 'Central Hospital Supply',
  },
  {
    id: 'COR-B1-SERVICE',
    name: 'Basement 1 Service Core Corridor',
    type: 'corridor',
    floor: 'Basement 1',
    wing: 'Service Core',
    level: 0,
  },
  {
    id: 'INT-B1-CENTRAL',
    name: 'Basement 1 Central Hub',
    type: 'intersection',
    floor: 'Basement 1',
    wing: 'Service Core',
    level: 0,
  },
  {
    id: 'ELEV-01-B1',
    name: 'Central Bed Elevator Lobby (Basement 1)',
    type: 'elevator',
    floor: 'Basement 1',
    wing: 'Service Core',
    level: 0,
    elevatorId: 'ELEV-01',
  },
];

/**
 * Standard horizontal corridor & room edges on each floor.
 */
export const HOSPITAL_HORIZONTAL_EDGES = [
  // Floor 1
  { from: 'RM-ER-101', to: 'COR-F1-EAST', distanceMeters: 10, type: 'room_exit' },
  { from: 'RM-ER-102', to: 'COR-F1-EAST', distanceMeters: 12, type: 'room_exit' },
  { from: 'RM-ER-103', to: 'COR-F1-EAST', distanceMeters: 12, type: 'room_exit' },
  { from: 'RM-ER-104', to: 'COR-F1-EAST', distanceMeters: 14, type: 'room_exit' },
  { from: 'COR-F1-EAST', to: 'INT-F1-CENTRAL', distanceMeters: 18, type: 'corridor_walk' },
  { from: 'RM-RAD-101', to: 'COR-F1-WEST', distanceMeters: 12, type: 'room_exit' },
  { from: 'COR-F1-WEST', to: 'INT-F1-CENTRAL', distanceMeters: 16, type: 'corridor_walk' },
  { from: 'RM-STOR-F1', to: 'INT-F1-CENTRAL', distanceMeters: 8, type: 'room_exit' },
  { from: 'INT-F1-CENTRAL', to: 'ELEV-01-F1', distanceMeters: 6, type: 'elevator_access' },

  // Floor 2
  { from: 'RM-ICU-201', to: 'COR-F2-NORTH', distanceMeters: 8, type: 'room_exit' },
  { from: 'RM-ICU-202', to: 'COR-F2-NORTH', distanceMeters: 10, type: 'room_exit' },
  { from: 'RM-ICU-203', to: 'COR-F2-NORTH', distanceMeters: 12, type: 'room_exit' },
  { from: 'RM-ICU-204', to: 'COR-F2-NORTH', distanceMeters: 16, type: 'room_exit' },
  { from: 'COR-F2-NORTH', to: 'INT-F2-CENTRAL', distanceMeters: 22, type: 'corridor_walk' },
  { from: 'RM-NICU-205', to: 'COR-F2-SOUTH', distanceMeters: 14, type: 'room_exit' },
  { from: 'RM-CCU-206', to: 'COR-F2-SOUTH', distanceMeters: 16, type: 'room_exit' },
  { from: 'COR-F2-SOUTH', to: 'INT-F2-CENTRAL', distanceMeters: 18, type: 'corridor_walk' },
  { from: 'RM-STOR-F2', to: 'INT-F2-CENTRAL', distanceMeters: 8, type: 'room_exit' },
  { from: 'INT-F2-CENTRAL', to: 'ELEV-01-F2', distanceMeters: 6, type: 'elevator_access' },

  // Floor 3
  { from: 'RM-OT-01', to: 'COR-F3-CENTRAL', distanceMeters: 12, type: 'room_exit' },
  { from: 'RM-OT-02', to: 'COR-F3-CENTRAL', distanceMeters: 14, type: 'room_exit' },
  { from: 'RM-OT-03', to: 'COR-F3-CENTRAL', distanceMeters: 15, type: 'room_exit' },
  { from: 'RM-PACU-01', to: 'COR-F3-CENTRAL', distanceMeters: 10, type: 'room_exit' },
  { from: 'COR-F3-CENTRAL', to: 'INT-F3-CENTRAL', distanceMeters: 12, type: 'corridor_walk' },
  { from: 'RM-W3A-05', to: 'COR-F3-WEST', distanceMeters: 10, type: 'room_exit' },
  { from: 'RM-W3B-12', to: 'COR-F3-WEST', distanceMeters: 15, type: 'room_exit' },
  { from: 'RM-W3C-20', to: 'COR-F3-WEST', distanceMeters: 18, type: 'room_exit' },
  { from: 'COR-F3-WEST', to: 'INT-F3-CENTRAL', distanceMeters: 20, type: 'corridor_walk' },
  { from: 'RM-STOR-F3', to: 'INT-F3-CENTRAL', distanceMeters: 8, type: 'room_exit' },
  { from: 'INT-F3-CENTRAL', to: 'ELEV-01-F3', distanceMeters: 6, type: 'elevator_access' },

  // Basement 1
  { from: 'RM-BIOMED-B1', to: 'COR-B1-SERVICE', distanceMeters: 10, type: 'room_exit' },
  { from: 'RM-SAN-BAY', to: 'COR-B1-SERVICE', distanceMeters: 14, type: 'room_exit' },
  { from: 'RM-STOR-B1', to: 'COR-B1-SERVICE', distanceMeters: 12, type: 'room_exit' },
  { from: 'COR-B1-SERVICE', to: 'INT-B1-CENTRAL', distanceMeters: 16, type: 'corridor_walk' },
  { from: 'INT-B1-CENTRAL', to: 'ELEV-01-B1', distanceMeters: 8, type: 'elevator_access' },
];

/**
 * Configured hospital elevator systems.
 * Elevators provide vertical transport across floors between configured elevator lobby nodes.
 */
export const DEFAULT_ELEVATORS = [
  {
    id: 'ELEV-01',
    name: 'Central Bed / Service Elevator 1',
    isOperational: true,
    capacity: 'Beds & Stretcher Units (2500 kg)',
    stops: ['ELEV-01-B1', 'ELEV-01-F1', 'ELEV-01-F2', 'ELEV-01-F3'],
  },
];

// In-memory route cache with topology versioning for fast recalculation and scale
let currentTopologyVersion = 1;
const routeCache = new Map();

/**
 * Invalidates cached Dijkstra shortest paths.
 * Call when hospital graph topology or elevator availability changes.
 */
export function invalidateRouteCache() {
  routeCache.clear();
  currentTopologyVersion++;
}

/**
 * Builds the hospital graph adjacency list from nodes, edges, and elevator definitions.
 * Allows passing options to test disabled elevators or custom graph topology.
 */
export function buildHospitalGraph(options = {}) {
  const {
    customNodes = HOSPITAL_NODES,
    customHorizontalEdges = HOSPITAL_HORIZONTAL_EDGES,
    elevators = DEFAULT_ELEVATORS,
    elevatorsEnabled = true,
  } = options;

  const nodeMap = new Map();
  const adjacency = new Map();

  for (const node of customNodes) {
    nodeMap.set(node.id, node);
    adjacency.set(node.id, []);
  }

  // 1. Add bidirectional horizontal edges
  for (const edge of customHorizontalEdges) {
    if (adjacency.has(edge.from) && adjacency.has(edge.to)) {
      const transitTimeSec = edge.transitTimeSeconds ?? Math.round(edge.distanceMeters / TRANSIT_SPEED_METERS_PER_SEC);
      adjacency.get(edge.from).push({
        to: edge.to,
        distanceMeters: edge.distanceMeters,
        transitTimeSeconds: transitTimeSec,
        type: edge.type || 'corridor_walk',
        isElevator: false,
      });
      adjacency.get(edge.to).push({
        to: edge.from,
        distanceMeters: edge.distanceMeters,
        transitTimeSeconds: transitTimeSec,
        type: edge.type || 'corridor_walk',
        isElevator: false,
      });
    }
  }

  // 2. Add vertical elevator shaft connections when enabled and operational
  if (elevatorsEnabled) {
    for (const elevator of elevators) {
      if (!elevator.isOperational) continue;

      const stops = elevator.stops.filter((sId) => nodeMap.has(sId));
      for (let i = 0; i < stops.length; i++) {
        for (let j = i + 1; j < stops.length; j++) {
          const fromId = stops[i];
          const toId = stops[j];
          const fromNode = nodeMap.get(fromId);
          const toNode = nodeMap.get(toId);

          const floorDelta = Math.abs(fromNode.level - toNode.level);
          const verticalMeters = floorDelta * ELEVATOR_VERTICAL_METERS_PER_FLOOR;
          const transitTimeSec = ELEVATOR_BASE_CYCLE_SECONDS + floorDelta * ELEVATOR_PER_FLOOR_SECONDS;

          adjacency.get(fromId).push({
            to: toId,
            distanceMeters: verticalMeters,
            transitTimeSeconds: transitTimeSec,
            type: 'elevator_transfer',
            isElevator: true,
            elevatorId: elevator.id,
            elevatorName: elevator.name,
            floorDelta,
          });

          adjacency.get(toId).push({
            to: fromId,
            distanceMeters: verticalMeters,
            transitTimeSeconds: transitTimeSec,
            type: 'elevator_transfer',
            isElevator: true,
            elevatorId: elevator.id,
            elevatorName: elevator.name,
            floorDelta,
          });
        }
      }
    }
  }

  return { nodeMap, adjacency, elevators };
}

// Singleton default graph
const defaultGraph = buildHospitalGraph();

/**
 * Resolves a room identifier (name, room code, or ID) to a graph node.
 * Supports exact IDs, room codes, full names, common colloquial room aliases
 * (such as "ICU Ward A" -> RM-ICU-201 Bed A), and room objects.
 */
export function resolveRoomNode(identifier, nodeMap = defaultGraph.nodeMap) {
  if (!identifier) return null;

  let clean = '';
  if (typeof identifier === 'object') {
    clean = String(identifier.name || identifier.roomCode || identifier.id || identifier.currentRoom || '').trim();
  } else {
    clean = String(identifier).trim();
  }

  if (!clean) return null;
  const lower = clean.toLowerCase();

  // 1. Exact node ID match
  if (nodeMap.has(clean)) return nodeMap.get(clean);

  // 2. Exact roomCode match
  for (const node of nodeMap.values()) {
    if (node.roomCode && node.roomCode.toLowerCase() === lower) {
      return node;
    }
  }

  // 3. Exact name match
  for (const node of nodeMap.values()) {
    if (node.name.toLowerCase() === lower) {
      return node;
    }
  }

  // 4. Common hospital clinical aliases (e.g., ICU Ward A -> ICU-201 Bed A)
  if (lower.includes('icu') && (lower.includes('ward a') || lower.includes('bed a') || lower.includes('201'))) {
    if (nodeMap.has('RM-ICU-201')) return nodeMap.get('RM-ICU-201');
  }
  if (lower.includes('icu') && (lower.includes('ward b') || lower.includes('bed b') || lower.includes('202'))) {
    if (nodeMap.has('RM-ICU-202')) return nodeMap.get('RM-ICU-202');
  }
  if (lower.includes('icu') && (lower.includes('ward c') || lower.includes('bed c') || lower.includes('203'))) {
    if (nodeMap.has('RM-ICU-203')) return nodeMap.get('RM-ICU-203');
  }
  if (lower.includes('icu') && (lower.includes('negative pressure') || lower.includes('isolation') || lower.includes('204'))) {
    if (nodeMap.has('RM-ICU-204')) return nodeMap.get('RM-ICU-204');
  }
  if (lower.includes('trauma bay 1') || lower.includes('er-101') || lower.includes('er 101')) {
    if (nodeMap.has('RM-ER-101')) return nodeMap.get('RM-ER-101');
  }
  if (lower.includes('acute resus') || lower.includes('er-102') || lower.includes('er 102')) {
    if (nodeMap.has('RM-ER-102')) return nodeMap.get('RM-ER-102');
  }
  if (lower.includes('ward 3a') || lower.includes('305')) {
    if (nodeMap.has('RM-W3A-05')) return nodeMap.get('RM-W3A-05');
  }
  if (lower.includes('ward 3b') || lower.includes('312')) {
    if (nodeMap.has('RM-W3B-12')) return nodeMap.get('RM-W3B-12');
  }
  if (lower.includes('ward 3c') || lower.includes('320')) {
    if (nodeMap.has('RM-W3C-20')) return nodeMap.get('RM-W3C-20');
  }
  if (lower.includes('biomed') || lower.includes('workshop')) {
    if (nodeMap.has('RM-BIOMED-B1')) return nodeMap.get('RM-BIOMED-B1');
  }
  if (lower.includes('sanitization') || lower.includes('decon')) {
    if (nodeMap.has('RM-SAN-BAY')) return nodeMap.get('RM-SAN-BAY');
  }
  if (lower.includes('storage b1') || lower.includes('clean equipment storage') || lower.includes('clean storage')) {
    if (nodeMap.has('RM-STOR-B1')) return nodeMap.get('RM-STOR-B1');
  }

  // 5. Code prefix or specific room query match (e.g. "ER-101" matching "ER-101 (Trauma Bay 1)")
  const firstToken = clean.split(' ')[0].toLowerCase().replace(/[^a-z0-9-]/g, '');
  for (const node of nodeMap.values()) {
    if (node.type === 'room' || node.type === 'storage') {
      const nodeToken = node.name.split(' ')[0].toLowerCase().replace(/[^a-z0-9-]/g, '');
      const nodeCode = (node.roomCode || node.id).toLowerCase();
      if (
        (firstToken && (firstToken === nodeToken || firstToken === nodeCode)) ||
        node.name.toLowerCase().includes(lower) ||
        lower.includes(node.name.toLowerCase())
      ) {
        return node;
      }
    }
  }

  return null;
}

/**
 * Calculates the shortest valid indoor route between two rooms using Dijkstra's algorithm.
 *
 * @param {string} fromIdentifier - Start room name or ID
 * @param {string} toIdentifier - Destination room name or ID
 * @param {object} [graphOptions={}] - Custom graph configuration (for unit tests / scenarios)
 * @returns {object} Route result object
 */
export function findShortestRoute(fromIdentifier, toIdentifier, graphOptions = {}) {
  const isDefaultGraph = Object.keys(graphOptions).length === 0;
  const cacheKey = isDefaultGraph && fromIdentifier && toIdentifier
    ? `${String(fromIdentifier).trim()}->${String(toIdentifier).trim()}:${currentTopologyVersion}`
    : null;

  if (cacheKey && routeCache.has(cacheKey)) {
    return JSON.parse(JSON.stringify(routeCache.get(cacheKey)));
  }

  const graph = isDefaultGraph ? defaultGraph : buildHospitalGraph(graphOptions);
  const { nodeMap, adjacency } = graph;

  const disclaimer =
    'Architectural floor-plan route estimate based on last confirmed dual-QR scan. Never represents real-time physical or RTLS tracking.';

  if (!fromIdentifier || !toIdentifier) {
    return {
      isNavigable: false,
      unreachableReason: 'Source or destination room identifier is missing.',
      fromRoom: null,
      toRoom: null,
      totalDistanceMeters: null,
      estimatedTransitMinutes: null,
      floorChanges: null,
      hasElevatorTransfer: false,
      steps: [],
      path: [],
      disclaimer,
    };
  }

  const startNode = resolveRoomNode(fromIdentifier, nodeMap);
  const targetNode = resolveRoomNode(toIdentifier, nodeMap);

  if (!startNode) {
    return {
      isNavigable: false,
      unreachableReason: `Starting location '${fromIdentifier}' is not registered in the hospital floor-plan graph.`,
      fromRoom: null,
      toRoom: targetNode ? targetNode.name : null,
      totalDistanceMeters: null,
      estimatedTransitMinutes: null,
      floorChanges: null,
      hasElevatorTransfer: false,
      steps: [],
      path: [],
      disclaimer,
    };
  }

  if (!targetNode) {
    return {
      isNavigable: false,
      unreachableReason: `Destination location '${toIdentifier}' is not registered in the hospital floor-plan graph.`,
      fromRoom: startNode.name,
      toRoom: null,
      totalDistanceMeters: null,
      estimatedTransitMinutes: null,
      floorChanges: null,
      hasElevatorTransfer: false,
      steps: [],
      path: [],
      disclaimer,
    };
  }

  // Same room immediate bedside
  if (startNode.id === targetNode.id) {
    return {
      isNavigable: true,
      fromRoom: startNode.name,
      toRoom: targetNode.name,
      totalDistanceMeters: 0,
      estimatedTransitSeconds: 0,
      estimatedTransitMinutes: 0,
      floorChanges: 0,
      hasElevatorTransfer: false,
      elevatorUsed: null,
      floorsVisited: [startNode.floor],
      steps: [
        {
          index: 1,
          instruction: `Equipment is already confirmed in target room (${targetNode.name}). Immediate bedside readiness.`,
          fromNode: startNode.name,
          toNode: targetNode.name,
          distanceMeters: 0,
          floor: startNode.floor,
          type: 'immediate',
        },
      ],
      path: [startNode],
      disclaimer,
    };
  }

  // Dijkstra's Algorithm
  const distances = new Map();
  const times = new Map();
  const previous = new Map();
  const visited = new Set();

  for (const node of nodeMap.values()) {
    distances.set(node.id, Infinity);
    times.set(node.id, Infinity);
  }

  distances.set(startNode.id, 0);
  times.set(startNode.id, 0);

  // Priority queue simulated via simple loop (graph is ~25 nodes, lightning fast)
  while (true) {
    let currentId = null;
    let shortestDist = Infinity;

    for (const [id, dist] of distances.entries()) {
      if (!visited.has(id) && dist < shortestDist) {
        shortestDist = dist;
        currentId = id;
      }
    }

    if (!currentId || shortestDist === Infinity) break;
    if (currentId === targetNode.id) break;

    visited.add(currentId);

    const neighbors = adjacency.get(currentId) || [];
    for (const edge of neighbors) {
      if (visited.has(edge.to)) continue;

      const altDist = distances.get(currentId) + edge.distanceMeters;
      const altTime = times.get(currentId) + edge.transitTimeSeconds;

      if (altDist < distances.get(edge.to)) {
        distances.set(edge.to, altDist);
        times.set(edge.to, altTime);
        previous.set(edge.to, { from: currentId, edge });
      }
    }
  }

  // Check reachability
  if (distances.get(targetNode.id) === Infinity) {
    const isDifferentFloor = startNode.floor !== targetNode.floor;
    const reason = isDifferentFloor
      ? `No configured elevator connection connects ${startNode.floor} and ${targetNode.floor}. Destination is vertically unreachable.`
      : `No valid corridor path exists between ${startNode.name} and ${targetNode.name}.`;

    return {
      isNavigable: false,
      unreachableReason: reason,
      fromRoom: startNode.name,
      toRoom: targetNode.name,
      totalDistanceMeters: null,
      estimatedTransitMinutes: null,
      floorChanges: null,
      hasElevatorTransfer: false,
      steps: [],
      path: [],
      disclaimer,
    };
  }

  // Reconstruct path
  const pathNodes = [];
  const edgeSequence = [];
  let curr = targetNode.id;

  while (curr) {
    pathNodes.unshift(nodeMap.get(curr));
    const prev = previous.get(curr);
    if (prev) {
      edgeSequence.unshift(prev.edge);
      curr = prev.from;
    } else {
      break;
    }
  }

  const totalDist = Math.round(distances.get(targetNode.id));
  const totalSeconds = Math.round(times.get(targetNode.id));
  const totalMinutes = Math.max(0.1, Number((totalSeconds / 60).toFixed(1)));

  // Floor changes & elevator analysis
  let floorChanges = 0;
  let hasElevatorTransfer = false;
  let elevatorUsed = null;
  const floorsVisited = [];

  for (const node of pathNodes) {
    if (!floorsVisited.includes(node.floor)) {
      floorsVisited.push(node.floor);
    }
  }

  if (startNode.level !== targetNode.level) {
    floorChanges = Math.abs(startNode.level - targetNode.level);
  }

  // Generate step-by-step navigation instructions
  const steps = [];
  for (let i = 0; i < edgeSequence.length; i++) {
    const edge = edgeSequence[i];
    const fromNode = pathNodes[i];
    const toNode = pathNodes[i + 1];

    let instruction = '';
    if (edge.isElevator) {
      hasElevatorTransfer = true;
      elevatorUsed = edge.elevatorName || 'Central Bed Elevator';
      const direction = toNode.level > fromNode.level ? 'up' : 'down';
      instruction = `Board ${edge.elevatorName || 'Central Bed Elevator'} and travel ${direction} to ${toNode.floor} (~${edge.transitTimeSeconds}s).`;
    } else if (fromNode.type === 'room') {
      instruction = `Exit ${fromNode.name} into ${toNode.name} (${edge.distanceMeters}m).`;
    } else if (toNode.type === 'room') {
      instruction = `Arrive at destination: Enter ${toNode.name} (${edge.distanceMeters}m).`;
    } else if (toNode.type === 'elevator') {
      instruction = `Proceed to ${toNode.name} (${edge.distanceMeters}m).`;
    } else if (fromNode.type === 'elevator') {
      instruction = `Exit elevator lobby into ${toNode.name} on ${toNode.floor} (${edge.distanceMeters}m).`;
    } else {
      instruction = `Traverse from ${fromNode.name} to ${toNode.name} (${edge.distanceMeters}m).`;
    }

    steps.push({
      index: i + 1,
      instruction,
      fromNode: fromNode.name,
      toNode: toNode.name,
      distanceMeters: edge.distanceMeters,
      transitTimeSeconds: edge.transitTimeSeconds,
      floor: toNode.floor,
      type: edge.type,
      isElevator: edge.isElevator,
    });
  }

  const result = {
    isNavigable: true,
    navigable: true,
    fromRoom: startNode.name,
    toRoom: targetNode.name,
    totalDistanceMeters: totalDist,
    estimatedTransitSeconds: totalSeconds,
    estimatedTransitMinutes: totalMinutes,
    floorChanges,
    hasElevatorTransfer,
    elevatorUsed,
    floorsVisited,
    steps,
    path: pathNodes.map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      floor: n.floor,
      wing: n.wing,
    })),
    disclaimer,
  };

  if (cacheKey) {
    routeCache.set(cacheKey, result);
  }

  return result;
}

export const calculateHospitalRoute = findShortestRoute;

export function getHospitalGraphTopology() {
  return {
    nodes: HOSPITAL_NODES,
    edges: HOSPITAL_HORIZONTAL_EDGES,
    elevators: DEFAULT_ELEVATORS,
    floors: FLOOR_LEVELS,
  };
}
