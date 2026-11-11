import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  findShortestRoute,
  HOSPITAL_NODES,
  HOSPITAL_HORIZONTAL_EDGES,
  DEFAULT_ELEVATORS,
  FLOOR_LEVELS,
} from '../services/indoorNavigation.js';

const router = express.Router();

// All indoor navigation endpoints require clinical/administrative authentication
router.use(authenticate);

/**
 * GET /api/navigation/route
 * Calculates the shortest valid route between two hospital locations using Dijkstra's algorithm.
 * Query params:
 *  - from: start room name or ID
 *  - to: destination room name or ID
 */
router.get('/route', (req, res, next) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: "Both 'from' and 'to' query parameters are required.",
        code: 'MISSING_ROUTE_PARAMS',
      });
    }

    const route = findShortestRoute(from, to);

    if (!route.isNavigable) {
      return res.status(404).json({
        success: false,
        error: route.unreachableReason || 'Destination is unreachable from the requested starting room.',
        code: 'ROUTE_UNREACHABLE',
        route,
      });
    }

    res.json({
      success: true,
      route,
      disclaimer: route.disclaimer,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/navigation/graph
 * Returns the hospital architectural graph topology (nodes, edges, elevator systems).
 */
router.get('/graph', (req, res) => {
  res.json({
    success: true,
    nodes: HOSPITAL_NODES,
    edges: HOSPITAL_HORIZONTAL_EDGES,
    elevators: DEFAULT_ELEVATORS,
    floorLevels: FLOOR_LEVELS,
    disclaimer:
      'Architectural floor-plan graph model. Equipment locations reflect last confirmed physical dual-scan, not live GPS/RTLS tracking.',
  });
});

export default router;
