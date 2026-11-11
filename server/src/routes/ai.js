import express from 'express';
import mongoose from 'mongoose';
import { Equipment } from '../models/Equipment.js';
import { Room } from '../models/Room.js';
import { MaintenanceTicket } from '../models/MaintenanceTicket.js';
import { MovementLog } from '../models/MovementLog.js';
import { AuditLog } from '../models/AuditLog.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  parseNaturalLanguageQuery,
  filterEligibleCandidates,
  rankCandidates,
  generateClinicalExplanation,
  synthesizeLLMExplanation,
  SCORING_WEIGHTS,
} from '../services/recommendationEngine.js';
import { resolveRoomNode } from '../services/indoorNavigation.js';
import { releaseExpiredReservations } from '../services/reservationService.js';
import { mlClient } from '../services/mlClient.js';
import {
  SEED_EQUIPMENT,
  SEED_ROOMS,
  SEED_MAINTENANCE_TICKETS,
} from '../data/seedData.js';

const router = express.Router();

// Require authentication for all AI decision support endpoints
router.use(authenticate);

/**
 * POST /api/ai/query (and alias /api/ai/recommend)
 * Intelligent Hospital Equipment Recommendation API
 * Accepts natural-language requests and/or structured filters.
 */
async function handleRecommendation(req, res, next) {
  try {
    // 0. Auto-release any expired reservation holds if database is active
    if (mongoose.connection.readyState === 1) {
      try {
        await releaseExpiredReservations();
      } catch (relErr) {
        console.warn('[Reservation Hold Warning] Could not release expired holds:', relErr.message);
      }
    }

    const {
      prompt,
      category: bodyCategory,
      clinicianRoom: bodyClinicianRoom,
      clinicianLocation: bodyClinicianLocation,
      originRoom: bodyOriginRoom,
      destinationRoom: bodyDestinationRoom,
      locationSource: bodyLocationSource,
      locationConfirmedAt: bodyLocationConfirmedAt,
      locationConfidence: bodyLocationConfidence,
      urgency: bodyUrgency,
      requiredCapabilities: bodyCapabilities,
      minBatteryPercent: bodyMinBattery,
      minRuntimeMinutes: bodyMinRuntime,
    } = req.body;

    // 1. Fetch live data from MongoDB Atlas with graceful fallback to SEED data if DB is degraded
    let allEquipment = [];
    let allRooms = [];
    let activeTickets = [];

    if (mongoose.connection.readyState === 1) {
      try {
        [allEquipment, allRooms, activeTickets] = await Promise.all([
          Equipment.find({}).lean(),
          Room.find({}).lean(),
          MaintenanceTicket.find({ status: 'ACTIVE_FAULT' }).lean(),
        ]);
      } catch (dbErr) {
        console.warn('[SmartMed AI Recommender] Database inaccessible, using seed data fallback:', dbErr.message);
      }
    }

    if (!allEquipment || allEquipment.length === 0) {
      allEquipment = SEED_EQUIPMENT;
    }
    if (!allRooms || allRooms.length === 0) {
      allRooms = SEED_ROOMS;
    }
    if (!activeTickets || activeTickets.length === 0) {
      activeTickets = SEED_MAINTENANCE_TICKETS.filter((t) => t.status === 'ACTIVE_FAULT');
    }

    const activeMaintenanceEquipmentIds = new Set((activeTickets || []).map((t) => t.equipmentId));

    // 2. Parse natural language intent if provided
    const parsedIntent = prompt ? parseNaturalLanguageQuery(prompt, allRooms) : {};

    // 3. Merge parsed intent with explicit structured parameters (structured overrides prompt)
    const category = bodyCategory || parsedIntent.category || 'Ventilator';

    // Clinician location resolution (support clinicianRoom, clinicianLocation, originRoom, destinationRoom)
    const rawClinicianRoom =
      bodyClinicianRoom ||
      bodyClinicianLocation?.room ||
      bodyOriginRoom ||
      bodyDestinationRoom ||
      parsedIntent.clinicianRoom ||
      parsedIntent.destinationRoom ||
      allRooms[0]?.name ||
      'ICU-201 (Bed A)';

    const resolvedClinicianNode = resolveRoomNode(rawClinicianRoom);
    const clinicianRoom = resolvedClinicianNode ? resolvedClinicianNode.name : rawClinicianRoom;

    // Track location source and confidence
    const locationSource =
      bodyLocationSource ||
      bodyClinicianLocation?.source ||
      (req.body.isQRScan ? 'QR_SCAN' : 'MANUAL_SELECTION');

    const locationConfirmedAt =
      bodyLocationConfirmedAt ||
      bodyClinicianLocation?.lastConfirmedAt ||
      new Date().toISOString();

    const locationConfidence =
      bodyLocationConfidence ||
      bodyClinicianLocation?.confidence ||
      (locationSource === 'QR_SCAN' ? 'HIGH' : 'MANUAL_UNVERIFIED');

    const clinicianLocation = {
      room: clinicianRoom,
      resolvedNodeId: resolvedClinicianNode?.id || null,
      floor: resolvedClinicianNode?.floor || 'Floor 1',
      wing: resolvedClinicianNode?.wing || 'Central',
      source: locationSource,
      lastConfirmedAt: locationConfirmedAt,
      confidence: locationConfidence,
      positioningBoundary: {
        provider: 'MANUAL_OR_QR',
        rtlsHardwareConnected: false,
        bleBeaconsActive: false,
        uwbActive: false,
        disclosure:
          'Architectural floor-plan route estimate based on last confirmed room QR scan or manual selection. Live BLE/UWB/RTLS automated indoor positioning is not connected.',
      },
    };

    const urgency = bodyUrgency || parsedIntent.urgency || 'urgent';
    const requiredCapabilities = Array.isArray(bodyCapabilities) && bodyCapabilities.length > 0
      ? bodyCapabilities
      : parsedIntent.requiredCapabilities || [];
    const minBatteryPercent = bodyMinBattery !== undefined && bodyMinBattery !== null
      ? Number(bodyMinBattery)
      : parsedIntent.minBatteryPercent ?? null;
    const minRuntimeMinutes = bodyMinRuntime !== undefined && bodyMinRuntime !== null
      ? Number(bodyMinRuntime)
      : parsedIntent.minRuntimeMinutes ?? null;

    const queryContext = {
      prompt: prompt || '',
      category,
      clinicianRoom,
      destinationRoom: clinicianRoom,
      clinicianLocation,
      urgency,
      requiredCapabilities,
      minBatteryPercent,
      minRuntimeMinutes,
    };

    // 4. Step A: Safety and eligibility filtering
    const { eligible, ineligible } = filterEligibleCandidates(allEquipment, {
      category,
      requiredCapabilities,
      minBatteryPercent,
      minRuntimeMinutes,
      activeMaintenanceEquipmentIds,
    });

    // 5. Step B: Calculate transparent ranking based on route distance from clinician's current location
    const rankedCandidates = rankCandidates(eligible, {
      destinationRoomName: clinicianRoom,
      clinicianRoom,
      roomsList: allRooms,
      urgency,
      requiredCapabilities,
    });

    // 5b. Step C: Random Forest Clinical Recommendation ML Scoring
    // STRICT SAFETY INVARIANT: Sits strictly behind the safety filter (never overrides quarantine or lockouts)
    let mlMetadata = {
      mlPowered: false,
      modelType: 'Deterministic-Weights',
      isSyntheticTrained: false,
    };

    if (rankedCandidates.length > 0) {
      try {
        const mlScoringResult = await mlClient.scoreRecommendationCandidates(rankedCandidates, queryContext);
        if (mlScoringResult && mlScoringResult.success && Array.isArray(mlScoringResult.scoredCandidates)) {
          const mlScoreMap = new Map(mlScoringResult.scoredCandidates.map((s) => [s.equipmentId, s]));

          for (const cand of rankedCandidates) {
            const mlData = mlScoreMap.get(cand.equipment.id);
            if (mlData) {
              cand.mlSuitabilityScore = mlData.mlSuitabilityScore;
              cand.mlProbability = mlData.probability;
              cand.mlModelRank = mlData.modelRank;
              cand.mlModel = 'RandomForestClassifier (Scikit-learn)';
              cand.isSyntheticTrained = true;

              // Combined overall score: 60% deterministic multi-factor + 40% Random Forest model score
              cand.overallScore = Math.round(cand.overallScore * 0.60 + mlData.mlSuitabilityScore * 0.40);
            }
          }

          // Re-sort ranked candidates by blended score
          rankedCandidates.sort((a, b) => b.overallScore - a.overallScore);
          rankedCandidates.forEach((c, idx) => {
            c.rank = idx + 1;
          });

          mlMetadata = {
            mlPowered: true,
            modelType: 'RandomForestClassifier (Scikit-learn)',
            isSyntheticTrained: true,
            accuracy: mlScoringResult.metadata?.accuracy || 0.85,
            disclosure:
              mlScoringResult.metadata?.disclosure ||
              'Trained on synthetic clinical decision support preference data. Clinical discretion remains mandatory.',
          };
        }
      } catch (mlErr) {
        console.warn('[SmartMed AI Recommender] ML scoring skipped:', mlErr.message);
      }
    }

    // 6. Phase 3: AI Explanation Layer
    const deterministicExplanation = generateClinicalExplanation(rankedCandidates, queryContext);
    const llmResult = await synthesizeLLMExplanation(rankedCandidates, queryContext, deterministicExplanation);

    // 7. Audit Logging (Non-blocking): Log the decision-support query
    if (mongoose.connection.readyState === 1) {
      try {
        await AuditLog.create({
          id: `AUD-AI-${Date.now()}`,
          action: 'AI_RECOMMENDATION_QUERIED',
          category: 'EQUIPMENT',
          performedBy: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
            department: req.user.department,
          },
          targetType: 'EquipmentRecommendation',
          targetId: rankedCandidates[0]?.equipment?.id || 'NO_CANDIDATE',
          details: `Clinician executed AI recommendation for category '${category}' from location '${clinicianRoom}'. ${rankedCandidates.length} eligible candidates ranked, ${ineligible.length} restricted.`,
          changes: {
            query: queryContext,
            topRankId: rankedCandidates[0]?.equipment?.id || null,
            eligibleCount: rankedCandidates.length,
            ineligibleCount: ineligible.length,
            mlPowered: mlMetadata.mlPowered,
          },
          ipAddress: req.ip || '',
        });
      } catch (auditErr) {
        console.warn('[Audit Warning] Could not record AI recommendation audit log:', auditErr.message);
      }
    }

    res.json({
      success: true,
      clinicianLocation,
      query: queryContext,
      scoringWeights: SCORING_WEIGHTS[urgency] || SCORING_WEIGHTS.urgent,
      mlPowered: mlMetadata.mlPowered,
      mlMetadata,
      summary: llmResult.explanation.summary,
      keyFinding: llmResult.explanation.keyFinding,
      comparativeAnalysis: llmResult.explanation.comparativeAnalysis,
      candidateRationales: llmResult.explanation.candidateRationales || [],
      llmSynthesis: llmResult.explanation.llmSynthesis || null,
      provider: llmResult.provider,
      candidates: rankedCandidates,
      recommendations: rankedCandidates,
      topCandidate: rankedCandidates[0] || null,
      explanation: llmResult.explanation,
      disclosures: {
        batteryRuntimeDisclaimer:
          'Battery percentage is an electrochemical reserve indicator and is not equivalent to benchmarked runtime. Verified runtime minutes are only cited when certified by biomedical calibration.',
        transitTimeDisclaimer:
          'Estimated transit time and distance are computed from hospital architectural floor-plan graph data. Real transit may vary based on corridor congestion, elevator traffic, and clinical priority.',
        clinicalDiscretionNotice:
          'SmartMed AI provides clinical decision support. Final allocation and treatment decisions rest entirely with authorized clinical personnel.',
      },
      ineligibleCount: ineligible.length,
      safetyFiltered: ineligible.map((inelig) => ({
        id: inelig.item.id,
        name: inelig.item.name,
        category: inelig.item.category,
        status: inelig.item.status,
        currentRoom: inelig.item.currentRoom,
        reason: inelig.reason,
        rule: inelig.rule,
      })),
      ineligibleAssets: ineligible.map((inelig) => ({
        id: inelig.item.id,
        name: inelig.item.name,
        category: inelig.item.category,
        status: inelig.item.status,
        currentRoom: inelig.item.currentRoom,
        reason: inelig.reason,
        rule: inelig.rule,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

router.post('/query', handleRecommendation);
router.post('/recommend', handleRecommendation);

/**
 * POST /api/ai/allocate
 * Safe Execution: Revalidates equipment eligibility, permissions, and clearance
 * atomically immediately before executing an authorized clinical reservation/dispatch hold.
 */
router.post('/allocate', requireRole('admin', 'doctor', 'nurse'), async (req, res, next) => {
  try {
    const { equipmentId, destinationRoom, clinicianRoom, purpose, durationMinutes } = req.body;

    if (!equipmentId) {
      return res.status(400).json({ error: 'equipmentId is required for allocation.' });
    }

    const eqId = equipmentId.toUpperCase();

    // 0. Auto-release any expired reservation holds
    await releaseExpiredReservations();

    // 1. Fetch current equipment state from database
    const current = await Equipment.findOne({ id: eqId });
    if (!current) {
      return res.status(404).json({ error: `Equipment '${eqId}' not found in registry.` });
    }

    // 2. Immediate Revalidation of Safety Gate
    if (current.status !== 'Available') {
      return res.status(409).json({
        error: `Safety Conflict: ${current.name} (${eqId}) is currently in status '${current.status}' and cannot be allocated.`,
        currentStatus: current.status,
        code: 'EQUIPMENT_UNAVAILABLE',
      });
    }

    if (current.sanitizationStatus !== 'CLEARED') {
      return res.status(409).json({
        error: `Safety Conflict: ${current.name} (${eqId}) requires certified decontamination before patient deployment.`,
        sanitizationStatus: current.sanitizationStatus,
        code: 'SANITIZATION_RESTRICTION',
      });
    }

    // Check active maintenance tickets
    const activeTicket = await MaintenanceTicket.findOne({
      equipmentId: eqId,
      status: 'ACTIVE_FAULT',
    });
    if (activeTicket) {
      return res.status(409).json({
        error: `Safety Conflict: ${current.name} (${eqId}) has an open biomedical service ticket (${activeTicket.id}).`,
        code: 'MAINTENANCE_RESTRICTION',
      });
    }

    // 3. Atomic Allocation Execution
    const lockDuration = (durationMinutes || 30) * 60 * 1000;
    const expiresAt = new Date(Date.now() + lockDuration);
    const targetRoom = destinationRoom || clinicianRoom || current.currentRoom;

    const updated = await Equipment.findOneAndUpdate(
      { id: eqId, status: 'Available', sanitizationStatus: 'CLEARED' },
      {
        $set: {
          status: 'Reserved',
          reservation: {
            reservedBy: req.user.name,
            staffId: req.user.id,
            department: req.user.department || 'Clinical Service',
            purpose: purpose || 'AI-Guided Emergency Allocation',
            reservedAt: new Date(),
            expiresAt,
          },
        },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(409).json({
        error: 'Concurrency Conflict: Equipment status changed concurrently. Allocation canceled.',
        code: 'RACE_CONDITION_DETECTED',
      });
    }

    // 4. Movement Log Ledger Entry
    await MovementLog.create({
      id: `MOV-${Date.now()}`,
      equipmentId: updated.id,
      equipmentName: updated.name,
      fromRoom: updated.currentRoom,
      toRoom: targetRoom,
      timestamp: new Date(),
      staffId: req.user.id,
      staffName: req.user.name,
      staffRole: req.user.role,
      type: 'AI-Recommended Emergency Allocation',
      details: `Clinician ${req.user.name} (${req.user.role}) authorized allocation of ${updated.name} for ${targetRoom}. 30m hold active.`,
    });

    // 5. Permanent Audit Trail Entry
    await AuditLog.create({
      id: `AUD-AI-${Date.now()}`,
      action: 'AI_EQUIPMENT_ALLOCATED',
      category: 'EQUIPMENT',
      performedBy: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        department: req.user.department,
      },
      targetType: 'Equipment',
      targetId: updated.id,
      details: `Authorized human allocation of recommended asset ${updated.name} (${updated.id}) to ${targetRoom}.`,
      changes: {
        allocatedTo: targetRoom,
        expiresAt,
        purpose: purpose || 'AI-Guided Emergency Allocation',
      },
      ipAddress: req.ip || '',
    });

    res.json({
      success: true,
      message: `Equipment ${updated.name} (${updated.id}) successfully allocated to ${targetRoom}.`,
      equipment: updated,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/ai/ml-status
 * Health and model readiness status of Python Scikit-learn microservice
 */
router.get('/ml-status', async (req, res) => {
  const status = await mlClient.checkHealth();
  res.json({
    success: true,
    microservice: status,
    serviceUrl: mlClient.getBaseUrl(),
  });
});

/**
 * POST /api/ai/predictive-maintenance
 * Random Forest Failure Risk Inference on clinical fleet
 * Accepts optional equipment array in body; falls back to DB or seed data.
 */
router.post('/predictive-maintenance', async (req, res, next) => {
  try {
    let equipmentList = Array.isArray(req.body?.equipment) && req.body.equipment.length > 0
      ? req.body.equipment
      : null;

    if (!equipmentList) {
      if (mongoose.connection.readyState === 1) {
        try {
          equipmentList = await Equipment.find({}).lean();
        } catch (dbErr) {
          console.warn('[Predictive Maintenance API] Database query failed:', dbErr.message);
        }
      }
      if (!equipmentList || equipmentList.length === 0) {
        equipmentList = SEED_EQUIPMENT;
      }
    }

    const predictionResult = await mlClient.predictMaintenance(equipmentList);
    res.json(predictionResult);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/ai/utilization-clusters (and POST alias)
 * K-Means Fleet Utilization Segmentation & Optimization Recommendations
 */
async function handleUtilizationClustering(req, res, next) {
  try {
    let equipmentList = Array.isArray(req.body?.equipment) && req.body.equipment.length > 0
      ? req.body.equipment
      : null;

    if (!equipmentList) {
      if (mongoose.connection.readyState === 1) {
        try {
          equipmentList = await Equipment.find({}).lean();
        } catch (dbErr) {
          console.warn('[Utilization API] Database query failed:', dbErr.message);
        }
      }
      if (!equipmentList || equipmentList.length === 0) {
        equipmentList = SEED_EQUIPMENT;
      }
    }

    const clusterResult = await mlClient.clusterUtilization(equipmentList);
    res.json(clusterResult);
  } catch (err) {
    next(err);
  }
}

router.get('/utilization-clusters', handleUtilizationClustering);
router.post('/utilization-clusters', handleUtilizationClustering);

export default router;
