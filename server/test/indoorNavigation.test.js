import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { JWT_SECRET } from '../src/middleware/auth.js';
import {
  findShortestRoute,
  buildHospitalGraph,
  resolveRoomNode,
  HOSPITAL_NODES,
  HOSPITAL_HORIZONTAL_EDGES,
} from '../src/services/indoorNavigation.js';
import {
  calculateTransit,
  rankCandidates,
} from '../src/services/recommendationEngine.js';

const doctorToken = jwt.sign(
  {
    id: 'USR-TEST-DOC',
    email: 'doctor@smartmed.hospital',
    role: 'doctor',
    name: 'Dr. Maya Lin',
    department: 'Emergency Medicine',
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

describe('SmartMed Hospital Indoor Navigation & Distance Intelligence Suite', () => {
  // 1. Same Floor Shortest Path
  describe('1. Same Floor Shortest Paths', () => {
    test('Calculates shortest route between adjacent rooms in same wing (ER-101 to ER-102)', () => {
      const route = findShortestRoute('ER-101 (Trauma Bay 1)', 'ER-102 (Acute Resus)');

      assert.equal(route.isNavigable, true);
      assert.equal(route.floorChanges, 0);
      assert.equal(route.hasElevatorTransfer, false);
      assert.equal(route.floorsVisited.length, 1);
      assert.equal(route.floorsVisited[0], 'Floor 1');
      assert.ok(route.totalDistanceMeters > 0, 'Distance must be positive');
      assert.ok(route.totalDistanceMeters <= 30, 'Adjacent rooms distance should be <= 30m');
      assert.ok(route.estimatedTransitMinutes > 0, 'Transit minutes must be positive');
      assert.ok(route.steps.length >= 2, 'Should contain room exit and entrance steps');
      assert.match(route.disclaimer, /Never represents real-time/);
    });

    test('Calculates shortest route cross-wing on the same floor (Ward 3A West Wing to OT-1 Central Block)', () => {
      const route = findShortestRoute('Ward 3A (Room 305)', 'OT-1 (General Surgery Suite)');

      assert.equal(route.isNavigable, true);
      assert.equal(route.floorChanges, 0);
      assert.equal(route.hasElevatorTransfer, false);
      assert.equal(route.floorsVisited[0], 'Floor 3');
      // Must traverse via Floor 3 Central Junction Hub
      const nodeIds = route.path.map((n) => n.id);
      assert.ok(nodeIds.includes('COR-F3-WEST'), 'Must traverse West corridor');
      assert.ok(nodeIds.includes('INT-F3-CENTRAL'), 'Must traverse Central Junction Hub');
      assert.ok(nodeIds.includes('COR-F3-CENTRAL'), 'Must traverse Surgical corridor');
      assert.ok(route.totalDistanceMeters >= 40, 'Cross-wing distance must reflect full corridor transit');
    });

    test('Immediate bedside: returns zero distance and instant readiness when start == destination', () => {
      const route = findShortestRoute('ER-101 (Trauma Bay 1)', 'ER-101 (Trauma Bay 1)');

      assert.equal(route.isNavigable, true);
      assert.equal(route.totalDistanceMeters, 0);
      assert.equal(route.estimatedTransitMinutes, 0);
      assert.equal(route.floorChanges, 0);
      assert.equal(route.hasElevatorTransfer, false);
      assert.match(route.steps[0].instruction, /immediate bedside/i);
    });
  });

  // 2. Multi-Floor Navigation & Vertical Elevator Shaft Transitions
  describe('2. Multi-Floor Navigation & Elevator Transitions', () => {
    test('Calculates multi-floor route from Floor 2 ICU to Floor 1 ER via Central Elevator', () => {
      const route = findShortestRoute(
        'ICU-204 (Negative Pressure Isolation)',
        'ER-101 (Trauma Bay 1)'
      );

      assert.equal(route.isNavigable, true);
      assert.equal(route.floorChanges, 1);
      assert.equal(route.hasElevatorTransfer, true);
      assert.ok(route.elevatorUsed, 'Elevator name must be populated');
      assert.ok(route.floorsVisited.includes('Floor 2'));
      assert.ok(route.floorsVisited.includes('Floor 1'));

      // Check path includes elevator lobby nodes on both floors
      const nodeIds = route.path.map((n) => n.id);
      assert.ok(nodeIds.includes('ELEV-01-F2'), 'Must enter Floor 2 elevator');
      assert.ok(nodeIds.includes('ELEV-01-F1'), 'Must exit Floor 1 elevator');

      // Check step instruction mentions elevator
      const elevatorStep = route.steps.find((s) => s.isElevator);
      assert.ok(elevatorStep, 'Must include an elevator step');
      assert.match(elevatorStep.instruction, /Central Bed \/ Service Elevator/);
    });

    test('Calculates 3-floor vertical transit from Basement 1 Decon to Floor 3 OT', () => {
      const route = findShortestRoute(
        'Central Sanitization & Decon Bay',
        'OT-2 (Cardiothoracic Theatre)'
      );

      assert.equal(route.isNavigable, true);
      assert.equal(route.floorChanges, 3);
      assert.equal(route.hasElevatorTransfer, true);
      assert.ok(route.totalDistanceMeters > 60, 'Multi-floor transit distance includes vertical and corridor travel');
      assert.ok(route.estimatedTransitMinutes >= 1.5, 'Multi-floor transit time includes elevator cycle');
    });
  });

  // 3. Unreachable Destinations & Isolated Nodes
  describe('3. Unreachable Destinations & Disabled Elevators', () => {
    test('Detects unreachable destination when elevators are disabled / unconfigured between floors', () => {
      const routeWithoutElevators = findShortestRoute(
        'ICU-204 (Negative Pressure Isolation)',
        'ER-101 (Trauma Bay 1)',
        { elevatorsEnabled: false }
      );

      assert.equal(routeWithoutElevators.isNavigable, false);
      assert.match(routeWithoutElevators.unreachableReason, /elevator/i);
      assert.equal(routeWithoutElevators.totalDistanceMeters, null);
      assert.equal(routeWithoutElevators.estimatedTransitMinutes, null);
    });

    test('Detects unreachable destination when a room is isolated with no corridor edges', () => {
      const customNodes = [
        ...HOSPITAL_NODES,
        {
          id: 'RM-ISOLATED-404',
          roomCode: 'RM-ISOLATED-404',
          name: 'Quarantined Auxiliary Annex 404',
          type: 'room',
          floor: 'Floor 1',
          wing: 'East Wing',
          level: 1,
        },
      ];

      const route = findShortestRoute('ER-101 (Trauma Bay 1)', 'Quarantined Auxiliary Annex 404', {
        customNodes,
        customHorizontalEdges: HOSPITAL_HORIZONTAL_EDGES,
      });

      assert.equal(route.isNavigable, false);
      assert.match(route.unreachableReason, /no valid corridor path/i);
    });
  });

  // 4. Invalid Locations & Error Handling
  describe('4. Invalid Locations & Error Handling', () => {
    test('Gracefully handles unregistered starting location', () => {
      const route = findShortestRoute('Nonexistent Storage Closet Z', 'ER-101 (Trauma Bay 1)');

      assert.equal(route.isNavigable, false);
      assert.match(route.unreachableReason, /Starting location 'Nonexistent Storage Closet Z' is not registered/);
    });

    test('Gracefully handles unregistered destination location', () => {
      const route = findShortestRoute('ER-101 (Trauma Bay 1)', 'Ghost Ward 99');

      assert.equal(route.isNavigable, false);
      assert.match(route.unreachableReason, /Destination location 'Ghost Ward 99' is not registered/);
    });

    test('Gracefully handles missing or null parameters', () => {
      const route = findShortestRoute(null, undefined);

      assert.equal(route.isNavigable, false);
      assert.match(route.unreachableReason, /missing/i);
    });
  });

  // 5. REST API Endpoints (/api/navigation)
  describe('5. REST API Endpoints', () => {
    test('GET /api/navigation/route rejects unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/navigation/route?from=RM-ER-101&to=RM-ER-102');
      assert.equal(res.status, 401);
    });

    test('GET /api/navigation/route rejects missing parameters with 400', async () => {
      const res = await request(app)
        .get('/api/navigation/route?from=RM-ER-101')
        .set('Authorization', `Bearer ${doctorToken}`);
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'MISSING_ROUTE_PARAMS');
    });

    test('GET /api/navigation/route returns valid shortest route when authenticated', async () => {
      const res = await request(app)
        .get('/api/navigation/route?from=RM-ER-101&to=RM-ICU-204')
        .set('Authorization', `Bearer ${doctorToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.route.isNavigable);
      assert.equal(res.body.route.floorChanges, 1);
      assert.equal(res.body.route.hasElevatorTransfer, true);
      assert.ok(Array.isArray(res.body.route.steps));
      assert.match(res.body.disclaimer, /Never represents real-time/);
    });

    test('GET /api/navigation/route returns 404 ROUTE_UNREACHABLE for unmodeled room', async () => {
      const res = await request(app)
        .get('/api/navigation/route?from=RM-ER-101&to=Unregistered-Room-X')
        .set('Authorization', `Bearer ${doctorToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.code, 'ROUTE_UNREACHABLE');
      assert.equal(res.body.route.isNavigable, false);
    });

    test('GET /api/navigation/graph returns complete hospital graph topology', async () => {
      const res = await request(app)
        .get('/api/navigation/graph')
        .set('Authorization', `Bearer ${doctorToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.nodes));
      assert.ok(Array.isArray(res.body.edges));
      assert.ok(Array.isArray(res.body.elevators));
      assert.match(res.body.disclaimer, /not live GPS\/RTLS tracking/);
    });
  });

  // 6. Recommendation Ranking Integration
  describe('6. Recommendation Ranking Integration', () => {
    test('rankCandidates integrates indoor navigation route steps and meters into candidate metrics', () => {
      const sampleRooms = [
        { id: 'RM-ER-101', name: 'ER-101 (Trauma Bay 1)', floor: 'Floor 1', wing: 'East Wing' },
        { id: 'RM-ER-102', name: 'ER-102 (Acute Resus)', floor: 'Floor 1', wing: 'East Wing' },
        { id: 'RM-ICU-204', name: 'ICU-204 (Negative Pressure Isolation)', floor: 'Floor 2', wing: 'North Wing' },
      ];

      const candidates = [
        {
          id: 'EQ-SAME',
          name: 'Ventilator Same Wing',
          category: 'Ventilator',
          status: 'Available',
          sanitizationStatus: 'CLEARED',
          batteryLevel: 90,
          hasBattery: true,
          currentRoom: 'ER-102 (Acute Resus)',
        },
        {
          id: 'EQ-FLOOR2',
          name: 'Ventilator Floor 2',
          category: 'Ventilator',
          status: 'Available',
          sanitizationStatus: 'CLEARED',
          batteryLevel: 90,
          hasBattery: true,
          currentRoom: 'ICU-204 (Negative Pressure Isolation)',
        },
      ];

      const ranked = rankCandidates(candidates, {
        destinationRoomName: 'ER-101 (Trauma Bay 1)',
        roomsList: sampleRooms,
        urgency: 'urgent',
      });

      assert.equal(ranked.length, 2);
      // EQ-SAME is on the same floor/wing, so its distance score must be higher than EQ-FLOOR2
      assert.equal(ranked[0].equipment.id, 'EQ-SAME');
      assert.equal(ranked[1].equipment.id, 'EQ-FLOOR2');

      // Verify indoor navigation metrics are attached
      assert.ok(ranked[0].metrics.transitMeters > 0);
      assert.equal(ranked[0].metrics.floorChanges, 0);
      assert.equal(ranked[0].metrics.hasElevatorTransfer, false);
      assert.ok(Array.isArray(ranked[0].metrics.routeSteps));
      assert.match(ranked[0].metrics.routeDisclaimer, /Never represents real-time/);

      assert.equal(ranked[1].metrics.floorChanges, 1);
      assert.equal(ranked[1].metrics.hasElevatorTransfer, true);
    });
  });
});
