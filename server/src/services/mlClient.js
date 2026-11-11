/**
SmartMed AI - Machine Learning Microservice Client Service
Provides resilient HTTP integration with the Python FastAPI ML microservice.
Supports timeout protection, health validation, and deterministic fallbacks.
*/

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
const DEFAULT_TIMEOUT_MS = 2500;

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export const mlClient = {
  getBaseUrl() {
    return ML_SERVICE_URL;
  },

  /**
   * Health check to detect if Python ML microservice is available
   */
  async checkHealth() {
    try {
      const res = await fetchWithTimeout(`${ML_SERVICE_URL}/health`, { method: 'GET' }, 1500);
      if (!res.ok) return { available: false, error: `HTTP ${res.status}` };
      const data = await res.json();
      return { available: true, ...data };
    } catch (err) {
      return { available: false, error: err.message };
    }
  },

  /**
   * Predict maintenance risk using Random Forest classifier
   * @param {Array<Object>} equipmentList
   * @returns {Promise<Object>}
   */
  async predictMaintenance(equipmentList = []) {
    if (!Array.isArray(equipmentList) || equipmentList.length === 0) {
      return { success: true, count: 0, results: [], metadata: { mlPowered: false } };
    }

    try {
      const payload = {
        equipment: equipmentList.map((item) => ({
          id: item.id || 'UNKNOWN',
          name: item.name || 'Equipment Asset',
          category: item.category || 'Ventilator',
          condition: item.condition || 'Optimal',
          operatingHours: Number(item.operatingHours || 0),
          batteryLevel: item.batteryLevel !== null && item.batteryLevel !== undefined ? Number(item.batteryLevel) : 100,
          hasBattery: item.hasBattery !== false,
          nextMaintenanceDate: item.nextMaintenanceDate || null,
          lastSanitizedAt: item.lastSanitizedAt || null,
          lastConfirmedAt: item.lastConfirmedAt || null,
          totalUsageSessions: Number(item.totalUsageSessions || 0),
          historicalFaultCount: item.status === 'Faulty' ? 2 : 0,
          movementFrequency: 4.0,
        })),
      };

      const res = await fetchWithTimeout(`${ML_SERVICE_URL}/predict/maintenance`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`ML Service responded with HTTP ${res.status}`);
      }

      const data = await res.json();
      return {
        ...data,
        mlPowered: true,
      };
    } catch (err) {
      console.warn('[ML Client Warning] Maintenance ML inference failed, using deterministic fallback:', err.message);
      // Fallback: rule-based calculation
      const fallbackResults = equipmentList.map((item) => {
        let score = 15;
        const reasons = [];
        if (item.status === 'Faulty') {
          score += 55;
          reasons.push('Active hardware fault flagged');
        } else if (item.status === 'Under Maintenance') {
          score += 45;
          reasons.push('Biomedical maintenance in progress');
        }
        if (item.operatingHours > 2500) {
          score += 25;
          reasons.push(`High runtime (${item.operatingHours}h)`);
        }
        if (item.hasBattery && item.batteryLevel !== null && item.batteryLevel < 40) {
          score += 15;
          reasons.push(`Low battery charge (${item.batteryLevel}%)`);
        }
        const finalScore = Math.min(100, score);
        return {
          equipmentId: item.id,
          equipmentName: item.name,
          category: item.category,
          failureRiskScore: finalScore,
          failureProbability30d: roundTo(finalScore / 100, 2),
          riskLevel: finalScore >= 70 ? 'CRITICAL' : finalScore >= 45 ? 'HIGH' : finalScore >= 25 ? 'MODERATE' : 'LOW',
          actionRecommendation: finalScore >= 45 ? 'Schedule biomedical inspection.' : 'Operating normally.',
          contributingFactors: reasons.length ? reasons : ['Normal operating parameters'],
          operatingHours: item.operatingHours || 0,
          isSyntheticTrained: false,
          model: 'Deterministic Heuristic Fallback',
        };
      });

      return {
        success: true,
        count: fallbackResults.length,
        results: fallbackResults,
        metadata: {
          mlPowered: false,
          model: 'Deterministic Heuristic Fallback',
          isSyntheticTrained: false,
          disclosure: 'Utilizing deterministic heuristic profile thresholds. Clinical telemetry model offline.',
        },
        mlPowered: false,
        fallbackReason: err.message,
      };
    }
  },

  /**
   * Cluster equipment fleet using Scikit-learn K-Means
   * @param {Array<Object>} equipmentList
   * @returns {Promise<Object>}
   */
  async clusterUtilization(equipmentList = []) {
    if (!Array.isArray(equipmentList) || equipmentList.length === 0) {
      return { success: true, count: 0, results: [], clusterSummaries: [], metadata: { mlPowered: false } };
    }

    try {
      const payload = {
        equipment: equipmentList.map((item) => ({
          id: item.id || 'UNKNOWN',
          name: item.name || 'Equipment Asset',
          category: item.category || 'Ventilator',
          condition: item.condition || 'Optimal',
          operatingHours: Number(item.operatingHours || 0),
          batteryLevel: item.batteryLevel !== null && item.batteryLevel !== undefined ? Number(item.batteryLevel) : 100,
          hasBattery: item.hasBattery !== false,
          totalUsageSessions: Number(item.totalUsageSessions || 0),
          movementFrequency: 4.0,
        })),
      };

      const res = await fetchWithTimeout(`${ML_SERVICE_URL}/cluster/utilization`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`ML Service responded with HTTP ${res.status}`);
      }

      const data = await res.json();
      return {
        ...data,
        mlPowered: true,
      };
    } catch (err) {
      console.warn('[ML Client Warning] Utilization clustering failed, using rule-based fallback:', err.message);
      // Fallback: heuristic utilization segmentation
      const fallbackResults = equipmentList.map((item) => {
        const hours = Number(item.operatingHours || 0);
        let profile = 'BALANCED';
        let clusterName = 'Optimal / Balanced';
        let color = '#10b981';
        let desc = 'Nominal utilization aligned with clinical quotas.';
        let rec = 'Maintain current assignment.';

        if (hours > 2800) {
          profile = 'OVERUTILIZED';
          clusterName = 'Overutilized / High Wear';
          color = '#ef4444';
          desc = 'High cumulative runtime hours and continuous deployment.';
          rec = 'Rotate with standby inventory to prevent wear.';
        } else if (hours < 600) {
          profile = 'UNDERUTILIZED';
          clusterName = 'Underutilized / Idle';
          color = '#f59e0b';
          desc = 'Low deployment runtime relative to hospital fleet average.';
          rec = 'Reallocate asset to higher demand departments.';
        }

        return {
          equipmentId: item.id,
          equipmentName: item.name,
          category: item.category,
          clusterId: profile === 'OVERUTILIZED' ? 2 : profile === 'UNDERUTILIZED' ? 1 : 0,
          clusterName,
          profileKey: profile,
          description: desc,
          riskLevel: profile === 'OVERUTILIZED' ? 'HIGH' : profile === 'UNDERUTILIZED' ? 'MODERATE' : 'LOW',
          actionRecommendation: rec,
          color,
          metrics: {
            operatingHours: hours,
            totalSessions: item.totalUsageSessions || 0,
            hoursPerSession: hours > 0 ? roundTo(hours / Math.max(1, item.totalUsageSessions || 1), 2) : 0,
            movementsPerMonth: 4,
            idleRatio: hours < 600 ? 0.8 : 0.45,
            turnaroundHours: hours > 2800 ? 2 : 6,
          },
        };
      });

      return {
        success: true,
        count: fallbackResults.length,
        results: fallbackResults,
        clusterSummaries: [
          { clusterId: 0, name: 'Optimal / Balanced', count: fallbackResults.filter(r => r.profileKey === 'BALANCED').length, color: '#10b981', actionRecommendation: 'Maintain protocol.' },
          { clusterId: 1, name: 'Underutilized / Idle', count: fallbackResults.filter(r => r.profileKey === 'UNDERUTILIZED').length, color: '#f59e0b', actionRecommendation: 'Reallocate to high demand units.' },
          { clusterId: 2, name: 'Overutilized / High Wear', count: fallbackResults.filter(r => r.profileKey === 'OVERUTILIZED').length, color: '#ef4444', actionRecommendation: 'Rotate asset with standby inventory.' },
        ],
        metadata: {
          algorithm: 'Heuristic Rule-Based Fallback',
          isSyntheticTrained: false,
          disclosure: 'Utilizing deterministic heuristic profile thresholds. Clinical telemetry model offline.',
        },
        mlPowered: false,
        fallbackReason: err.message,
      };
    }
  },

  /**
   * Score candidate devices using Random Forest Clinical Recommendation model
   * @param {Array<Object>} candidates - Eligible ranked candidates from recommendationEngine
   * @param {Object} queryContext
   * @returns {Promise<Object>}
   */
  async scoreRecommendationCandidates(candidates = [], queryContext = {}) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return { success: true, scoredCandidates: [], mlPowered: false };
    }

    try {
      const payload = {
        candidates: candidates.map((c) => {
          const metrics = c.metrics || {};
          const transit = metrics.transit || {};
          const route = transit.route || {};
          const item = c.equipment || {};

          return {
            equipmentId: item.id || c.equipmentId || 'UNKNOWN',
            name: item.name || c.name || 'Candidate Asset',
            transitDistanceMeters: Number(metrics.distanceMeters || route.totalDistanceMeters || 30.0),
            estimatedTransitMinutes: Number(metrics.transitMinutes || route.estimatedTransitMinutes || 1.0),
            batteryLevel: Number(metrics.batteryLevel !== null && metrics.batteryLevel !== undefined ? metrics.batteryLevel : 100),
            verifiedRuntimeMinutes: metrics.verifiedRuntimeMinutes !== null && metrics.verifiedRuntimeMinutes !== undefined ? Number(metrics.verifiedRuntimeMinutes) : null,
            hasBattery: metrics.hasBattery !== false,
            operatingHours: Number(metrics.operatingHours || item.operatingHours || 500.0),
            condition: metrics.condition || item.condition || 'Optimal',
            urgency: queryContext.urgency || 'urgent',
            capabilityMatchRatio: 1.0,
            floorChangeCount: Number(route.floorChanges || 0),
            isRuntimeVerified: metrics.runtimeStatus === 'VERIFIED',
          };
        }),
        queryContext,
      };

      const res = await fetchWithTimeout(`${ML_SERVICE_URL}/predict/recommend`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`ML Service responded with HTTP ${res.status}`);
      }

      const data = await res.json();
      return {
        ...data,
        mlPowered: true,
      };
    } catch (err) {
      console.warn('[ML Client Warning] Recommender ML inference failed, using deterministic scoring:', err.message);
      return {
        success: false,
        scoredCandidates: [],
        mlPowered: false,
        fallbackReason: err.message,
      };
    }
  },
};

function roundTo(num, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}
