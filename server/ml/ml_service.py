"""
SmartMed AI - Machine Learning Microservice API
Framework: FastAPI + Uvicorn
Endpoints:
- GET  /health: Microservice and loaded model status
- POST /predict/maintenance: Random Forest predictive maintenance failure risk scoring
- POST /cluster/utilization: K-Means equipment fleet utilization analysis and clustering
- POST /predict/recommend: Random Forest clinical candidate recommendation scoring
"""

import os
import json
import numpy as np
import pandas as pd
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import joblib

app = FastAPI(
    title="SmartMed AI - Machine Learning Microservice",
    version="1.0.0",
    description="Scikit-learn powered ML services for SmartMed Hospital Fleet Operations"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(__file__)
MODELS_DIR = os.path.join(BASE_DIR, "models")

# Load models and metadata on startup
models = {}
metadata = {}

CATEGORIES = [
    "Ventilator",
    "Defibrillator",
    "Infusion Pump",
    "Portable Ultrasound",
    "ECG Machine",
    "Patient Monitor",
    "Transport Wheelchair",
]
CATEGORY_MAP = {cat.lower(): i for i, cat in enumerate(CATEGORIES)}
CONDITION_MAP = {"optimal": 0, "good": 1, "fair": 2}


def load_artifacts():
    try:
        maint_path = os.path.join(MODELS_DIR, "predictive_maintenance_rf.joblib")
        if os.path.exists(maint_path):
            models["maintenance"] = joblib.load(maint_path)
            with open(os.path.join(MODELS_DIR, "predictive_maintenance_metrics.json"), "r") as f:
                metadata["maintenance"] = json.load(f)
            print("[SmartMed ML Service] Loaded Predictive Maintenance model.")
    except Exception as e:
        print("[SmartMed ML Service] Error loading maintenance model:", e)

    try:
        util_path = os.path.join(MODELS_DIR, "utilization_kmeans.joblib")
        if os.path.exists(util_path):
            models["utilization"] = joblib.load(util_path)
            with open(os.path.join(MODELS_DIR, "utilization_clusters.json"), "r") as f:
                metadata["utilization"] = json.load(f)
            print("[SmartMed ML Service] Loaded K-Means Utilization model.")
    except Exception as e:
        print("[SmartMed ML Service] Error loading utilization model:", e)

    try:
        rec_path = os.path.join(MODELS_DIR, "recommender_rf.joblib")
        if os.path.exists(rec_path):
            models["recommender"] = joblib.load(rec_path)
            with open(os.path.join(MODELS_DIR, "recommender_metrics.json"), "r") as f:
                metadata["recommender"] = json.load(f)
            print("[SmartMed ML Service] Loaded Recommendation model.")
    except Exception as e:
        print("[SmartMed ML Service] Error loading recommender model:", e)


load_artifacts()


# ============================================================================
# Request / Response Schemas
# ============================================================================

class EquipmentTelemetryInput(BaseModel):
    id: str
    name: Optional[str] = "Equipment Asset"
    category: Optional[str] = "Ventilator"
    condition: Optional[str] = "Optimal"
    operatingHours: Optional[float] = 0.0
    batteryLevel: Optional[float] = 100.0
    hasBattery: Optional[bool] = True
    nextMaintenanceDate: Optional[str] = None
    lastSanitizedAt: Optional[str] = None
    lastConfirmedAt: Optional[str] = None
    totalUsageSessions: Optional[int] = 0
    historicalFaultCount: Optional[int] = 0
    movementFrequency: Optional[float] = 4.0


class PredictiveMaintenanceBatchRequest(BaseModel):
    equipment: List[EquipmentTelemetryInput]


class CandidateFeatureInput(BaseModel):
    equipmentId: str
    name: Optional[str] = "Candidate Asset"
    transitDistanceMeters: float = 20.0
    estimatedTransitMinutes: float = 1.0
    batteryLevel: float = 100.0
    verifiedRuntimeMinutes: Optional[float] = None
    hasBattery: bool = True
    operatingHours: float = 500.0
    condition: str = "Optimal"
    urgency: str = "urgent"
    capabilityMatchRatio: float = 1.0
    floorChangeCount: int = 0
    isRuntimeVerified: bool = True


class RecommendationBatchRequest(BaseModel):
    candidates: List[CandidateFeatureInput]
    queryContext: Optional[Dict[str, Any]] = None


# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "SmartMed AI - Scikit-learn Machine Learning Microservice",
        "models_loaded": {
            "predictive_maintenance_rf": "maintenance" in models,
            "utilization_kmeans": "utilization" in models,
            "recommender_rf": "recommender" in models,
        },
        "is_synthetic_trained": True,
        "disclosure": "Models trained on synthetic hospital operational data. Clinical discretion remains mandatory.",
    }


@app.post("/predict/maintenance")
def predict_maintenance(request: PredictiveMaintenanceBatchRequest):
    if "maintenance" not in models:
        raise HTTPException(status_code=503, detail="Predictive maintenance model is not loaded.")

    pipeline = models["maintenance"]
    results = []

    for item in request.equipment:
        # 1. Feature Extraction & Safe Fallbacks
        op_hours = float(item.operatingHours or 0.0)
        battery = float(item.batteryLevel if item.hasBattery and item.batteryLevel is not None else 100.0)
        
        # Estimate battery cycles from operating hours if unmetered
        battery_cycles = min(600.0, (op_hours / 7.0)) if item.hasBattery else 0.0

        # Calculate days until scheduled maintenance
        days_until_maint = 90.0
        if item.nextMaintenanceDate:
            try:
                maint_ts = pd.to_datetime(item.nextMaintenanceDate).timestamp()
                now_ts = pd.Timestamp.now().timestamp()
                days_until_maint = (maint_ts - now_ts) / (3600 * 24)
            except Exception:
                days_until_maint = 60.0

        # Days since last sanitization
        days_since_san = 3.0
        if item.lastSanitizedAt:
            try:
                san_ts = pd.to_datetime(item.lastSanitizedAt).timestamp()
                now_ts = pd.Timestamp.now().timestamp()
                days_since_san = max(0.1, (now_ts - san_ts) / (3600 * 24))
            except Exception:
                days_since_san = 3.0

        cond_code = CONDITION_MAP.get(str(item.condition).lower(), 0)
        cat_code = CATEGORY_MAP.get(str(item.category).lower(), 0)
        avg_daily = min(20.0, max(1.0, op_hours / 180.0))
        hist_faults = int(item.historicalFaultCount or 0)

        features = [
            op_hours,
            battery,
            battery_cycles,
            days_since_san,
            days_until_maint,
            cond_code,
            cat_code,
            avg_daily,
            hist_faults,
        ]

        # ML Inference
        X = pd.DataFrame([features], columns=[
            "operating_hours",
            "battery_level",
            "battery_wear_cycles",
            "days_since_last_sanitization",
            "days_until_scheduled_maintenance",
            "condition_code",
            "category_code",
            "avg_daily_usage_hours",
            "historical_fault_count",
        ])

        proba = float(pipeline.predict_proba(X)[0][1])
        risk_score = int(round(proba * 100))

        if risk_score >= 70:
            risk_level = "CRITICAL"
            action = "Immediate biomedical overhaul & safety isolation required."
        elif risk_score >= 45:
            risk_level = "HIGH"
            action = "Schedule preventive biomedical maintenance within 7 days."
        elif risk_score >= 25:
            risk_level = "MODERATE"
            action = "Monitor equipment; calibration due soon."
        else:
            risk_level = "LOW"
            action = "Operating within optimal clinical tolerance."

        # Key risk contributors
        factors = []
        if days_until_maint <= 0:
            factors.append(f"Scheduled maintenance is overdue by {abs(round(days_until_maint))} days")
        elif days_until_maint <= 14:
            factors.append(f"Scheduled maintenance due in {round(days_until_maint)} days")
        if op_hours > 2500:
            factors.append(f"Cumulative runtime wear ({round(op_hours)}h > 2500h)")
        if cond_code >= 1:
            factors.append(f"Physical condition graded as '{item.condition}'")
        if battery < 40 and item.hasBattery:
            factors.append(f"Depleted battery reserve ({round(battery)}%)")
        if not factors:
            factors.append("Nominal operational telemetry")

        results.append({
            "equipmentId": item.id,
            "equipmentName": item.name,
            "category": item.category,
            "failureRiskScore": risk_score,
            "failureProbability30d": round(proba, 4),
            "riskLevel": risk_level,
            "actionRecommendation": action,
            "contributingFactors": factors,
            "operatingHours": op_hours,
            "daysUntilMaintenance": round(days_until_maint, 1),
            "isSyntheticTrained": True,
            "model": "RandomForestClassifier (Scikit-learn)",
        })

    return {
        "success": True,
        "count": len(results),
        "results": results,
        "metadata": {
            "model": "RandomForestClassifier",
            "isSyntheticTrained": True,
            "disclosure": metadata.get("maintenance", {}).get("data_disclosure", "Trained on synthetic clinical data."),
            "accuracy": metadata.get("maintenance", {}).get("accuracy", 0.89),
        }
    }


@app.post("/cluster/utilization")
def cluster_utilization(request: PredictiveMaintenanceBatchRequest):
    if "utilization" not in models:
        raise HTTPException(status_code=503, detail="Utilization clustering model is not loaded.")

    pipeline = models["utilization"]
    meta = metadata.get("utilization", {})
    cluster_defs = meta.get("cluster_definitions", {})

    items = request.equipment
    if not items:
        return {"success": True, "count": 0, "results": [], "fleetSummary": {}}

    feature_rows = []
    ids = []
    names = []
    categories = []

    for item in items:
        op_hours = float(item.operatingHours or 100.0)
        sessions = max(1, int(item.totalUsageSessions or max(5, int(op_hours / 12.0))))
        hps = round(op_hours / sessions, 2)
        moves = float(item.movementFrequency or 4.0)

        # Idle ratio estimate
        total_life_hours = max(op_hours, 365.0 * 24.0)
        idle_ratio = round(max(0.1, min(0.95, 1.0 - (op_hours / total_life_hours))), 3)
        turnaround = round(max(0.5, min(48.0, 72.0 / (sessions + 1))), 1)

        feature_rows.append([op_hours, sessions, hps, moves, idle_ratio, turnaround])
        ids.append(item.id)
        names.append(item.name)
        categories.append(item.category)

    df_feats = pd.DataFrame(feature_rows, columns=[
        "operating_hours",
        "total_usage_sessions",
        "hours_per_session",
        "movement_frequency_per_month",
        "idle_ratio",
        "turnaround_time_hours",
    ])

    cluster_indices = pipeline.predict(df_feats)

    results = []
    cluster_counts = {str(i): 0 for i in range(4)}

    for idx, c_idx in enumerate(cluster_indices):
        c_str = str(c_idx)
        cluster_counts[c_str] = cluster_counts.get(c_str, 0) + 1
        c_def = cluster_defs.get(c_str, {
            "name": f"Cluster {c_idx}",
            "description": "Utilization cluster profile",
            "risk_level": "LOW",
            "action_recommendation": "Review operational metrics.",
            "color": "#38bdf8",
        })

        results.append({
            "equipmentId": ids[idx],
            "equipmentName": names[idx],
            "category": categories[idx],
            "clusterId": int(c_idx),
            "clusterName": c_def.get("name"),
            "profileKey": c_def.get("profile_key", "BALANCED"),
            "description": c_def.get("description"),
            "riskLevel": c_def.get("risk_level"),
            "actionRecommendation": c_def.get("action_recommendation"),
            "color": c_def.get("color"),
            "metrics": {
                "operatingHours": feature_rows[idx][0],
                "totalSessions": feature_rows[idx][1],
                "hoursPerSession": feature_rows[idx][2],
                "movementsPerMonth": feature_rows[idx][3],
                "idleRatio": feature_rows[idx][4],
                "turnaroundHours": feature_rows[idx][5],
            }
        })

    # Aggregate Fleet Summary
    total_assets = len(items)
    cluster_summaries = []
    for c_str, count in cluster_counts.items():
        c_def = cluster_defs.get(c_str, {})
        pct = round((count / total_assets) * 100, 1) if total_assets > 0 else 0
        cluster_summaries.append({
            "clusterId": int(c_str),
            "name": c_def.get("name", f"Cluster {c_str}"),
            "profileKey": c_def.get("profile_key", "BALANCED"),
            "count": count,
            "percentage": pct,
            "description": c_def.get("description", ""),
            "actionRecommendation": c_def.get("action_recommendation", ""),
            "color": c_def.get("color", "#38bdf8"),
            "benchmarks": c_def.get("centroid_benchmarks", {}),
        })

    return {
        "success": True,
        "count": len(results),
        "results": results,
        "clusterSummaries": cluster_summaries,
        "metadata": {
            "algorithm": "KMeans(k=4, Scikit-learn)",
            "silhouetteScore": meta.get("silhouette_score", 0.48),
            "isSyntheticTrained": True,
            "disclosure": meta.get("data_disclosure", "Trained on synthetic equipment utilization records."),
        }
    }


@app.post("/predict/recommend")
def predict_recommendation(request: RecommendationBatchRequest):
    if "recommender" not in models:
        raise HTTPException(status_code=503, detail="Recommender model is not loaded.")

    pipeline = models["recommender"]
    candidates = request.candidates

    if not candidates:
        return {"success": True, "scoredCandidates": []}

    feature_rows = []
    for c in candidates:
        verified_mins = c.verifiedRuntimeMinutes if c.verifiedRuntimeMinutes is not None else (c.batteryLevel * 1.8 if c.hasBattery else 120.0)
        cond_code = CONDITION_MAP.get(c.condition.lower(), 0)
        urg_code = 1 if c.urgency.lower() in ["urgent", "stat", "emergency"] else 0
        is_verified = 1 if c.isRuntimeVerified else 0

        feature_rows.append([
            float(c.transitDistanceMeters),
            float(c.estimatedTransitMinutes),
            float(c.batteryLevel),
            float(verified_mins),
            float(c.operatingHours),
            int(cond_code),
            int(urg_code),
            float(c.capabilityMatchRatio),
            int(c.floorChangeCount),
            int(is_verified),
        ])

    df_feats = pd.DataFrame(feature_rows, columns=[
        "transit_distance_meters",
        "estimated_transit_minutes",
        "battery_level",
        "verified_runtime_minutes",
        "operating_hours",
        "condition_code",
        "urgency_code",
        "capability_match_ratio",
        "floor_change_count",
        "is_runtime_verified",
    ])

    probas = pipeline.predict_proba(df_feats)[:, 1]

    scored = []
    for i, c in enumerate(candidates):
        ml_score = int(round(probas[i] * 100))
        scored.append({
            "equipmentId": c.equipmentId,
            "name": c.name,
            "mlSuitabilityScore": ml_score,
            "probability": round(float(probas[i]), 4),
            "modelRank": 0, # Will be set below
            "modelType": "RandomForestClassifier",
            "isSyntheticTrained": True,
        })

    # Sort candidates by ML suitability score descending
    scored.sort(key=lambda x: x["mlSuitabilityScore"], reverse=True)
    for rank, item in enumerate(scored, 1):
        item["modelRank"] = rank

    return {
        "success": True,
        "scoredCandidates": scored,
        "metadata": {
            "model": "RandomForestClassifier",
            "isSyntheticTrained": True,
            "accuracy": metadata.get("recommender", {}).get("accuracy", 0.85),
            "disclosure": metadata.get("recommender", {}).get("data_disclosure", "Trained on synthetic clinical decision preference data."),
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
