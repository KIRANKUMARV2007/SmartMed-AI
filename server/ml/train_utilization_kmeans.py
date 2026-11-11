"""
SmartMed AI - Equipment Fleet Utilization Clustering Pipeline
Model: Scikit-learn K-Means Clustering
Target: Segment hospital equipment fleet into actionable operational utilization profiles
Dataset: Synthetic clinical utilization dataset (clearly labeled and documented)
"""

import os
import json
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.pipeline import Pipeline
from sklearn.metrics import silhouette_score
import joblib

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

FEATURE_COLUMNS = [
    "operating_hours",
    "total_usage_sessions",
    "hours_per_session",
    "movement_frequency_per_month",
    "idle_ratio",
    "turnaround_time_hours",
]

CLUSTER_PROFILES = {
    "OVERUTILIZED": {
        "name": "Overutilized / High Wear",
        "description": "High continuous operating hours with minimal idle time. High mechanical wear and bottleneck risk.",
        "risk_level": "HIGH",
        "action_recommendation": "Rotate asset with standby inventory to prevent premature component breakdown; schedule preventative calibration.",
        "color": "#ef4444",
    },
    "BALANCED": {
        "name": "Optimal / Balanced",
        "description": "Consistent clinical utilization aligned with departmental procedure quotas and maintenance schedules.",
        "risk_level": "LOW",
        "action_recommendation": "Maintain current deployment protocol. Routine biomedical checkups suffice.",
        "color": "#10b981",
    },
    "UNDERUTILIZED": {
        "name": "Underutilized / Idle",
        "description": "Asset experiences prolonged inactivity with idle ratios exceeding 70% of clinical deployment time.",
        "risk_level": "MODERATE",
        "action_recommendation": "Reallocate asset to high-demand units (e.g., ICU, Emergency) or return to central pool.",
        "color": "#f59e0b",
    },
    "HIGH_MOBILITY": {
        "name": "High Turnaround / Rapid Relocation",
        "description": "Frequent inter-departmental transfers, rapid turnaround (< 2h), and surge emergency utilization.",
        "risk_level": "LOW",
        "action_recommendation": "Ensure battery readiness protocols and dual-QR transit tracking remain strictly logged.",
        "color": "#38bdf8",
    },
}


def generate_synthetic_utilization_dataset(n_samples=800, random_seed=42):
    """
    Generates domain-grounded synthetic fleet utilization records.
    Explicitly labeled as synthetic data.
    """
    np.random.seed(random_seed)

    # 4 distinct clinical operating profiles:
    # 1. Overutilized: High hours (2800-4500), high sessions (180-350), low idle (0.10-0.35), low turnaround (1-3h), high moves (6-15)
    # 2. Balanced: Medium hours (1200-2600), medium sessions (80-180), medium idle (0.35-0.60), turnaround (3-8h), moves (3-8)
    # 3. Underutilized: Low hours (100-900), low sessions (10-50), high idle (0.70-0.95), turnaround (12-48h), moves (1-4)
    # 4. High Mobility: Medium hours (1400-2800), high sessions (150-300), medium idle (0.30-0.55), turnaround (1-3h), high moves (12-28)

    sub_n = n_samples // 4

    # Group 1: Overutilized
    g1_hours = np.random.normal(3400, 450, sub_n).clip(2200, 4800)
    g1_sessions = np.random.normal(260, 40, sub_n).clip(170, 380)
    g1_hps = (g1_hours / g1_sessions).clip(6, 24)
    g1_moves = np.random.normal(9, 2.5, sub_n).clip(4, 18)
    g1_idle = np.random.normal(0.22, 0.06, sub_n).clip(0.08, 0.35)
    g1_turnaround = np.random.normal(2.2, 0.7, sub_n).clip(0.8, 4.0)

    # Group 2: Balanced
    g2_hours = np.random.normal(1800, 350, sub_n).clip(1000, 2700)
    g2_sessions = np.random.normal(130, 25, sub_n).clip(70, 190)
    g2_hps = (g2_hours / g2_sessions).clip(5, 20)
    g2_moves = np.random.normal(5, 1.5, sub_n).clip(2, 9)
    g2_idle = np.random.normal(0.48, 0.06, sub_n).clip(0.36, 0.62)
    g2_turnaround = np.random.normal(5.5, 1.2, sub_n).clip(2.5, 9.0)

    # Group 3: Underutilized
    g3_hours = np.random.normal(480, 180, sub_n).clip(80, 950)
    g3_sessions = np.random.normal(28, 10, sub_n).clip(8, 55)
    g3_hps = (g3_hours / g3_sessions).clip(4, 22)
    g3_moves = np.random.normal(2, 0.8, sub_n).clip(1, 4)
    g3_idle = np.random.normal(0.82, 0.05, sub_n).clip(0.70, 0.95)
    g3_turnaround = np.random.normal(22.0, 6.0, sub_n).clip(10.0, 48.0)

    # Group 4: High Mobility
    g4_hours = np.random.normal(2100, 380, sub_n).clip(1200, 3000)
    g4_sessions = np.random.normal(210, 35, sub_n).clip(130, 310)
    g4_hps = (g4_hours / g4_sessions).clip(4, 16)
    g4_moves = np.random.normal(18, 4.0, sub_n).clip(11, 30)
    g4_idle = np.random.normal(0.38, 0.06, sub_n).clip(0.24, 0.52)
    g4_turnaround = np.random.normal(1.8, 0.5, sub_n).clip(0.5, 3.2)

    df = pd.DataFrame({
        "operating_hours": np.round(np.concatenate([g1_hours, g2_hours, g3_hours, g4_hours]), 1),
        "total_usage_sessions": np.round(np.concatenate([g1_sessions, g2_sessions, g3_sessions, g4_sessions]), 0).astype(int),
        "hours_per_session": np.round(np.concatenate([g1_hps, g2_hps, g3_hps, g4_hps]), 2),
        "movement_frequency_per_month": np.round(np.concatenate([g1_moves, g2_moves, g3_moves, g4_moves]), 1),
        "idle_ratio": np.round(np.concatenate([g1_idle, g2_idle, g3_idle, g4_idle]), 3),
        "turnaround_time_hours": np.round(np.concatenate([g1_turnaround, g2_turnaround, g3_turnaround, g4_turnaround]), 1),
        "data_source": "SYNTHETIC_SIMULATED_DATA",
    })

    return df


def train_and_save_model():
    print("[SmartMed ML] Generating synthetic equipment utilization dataset...")
    df = generate_synthetic_utilization_dataset(n_samples=1000, random_seed=42)

    csv_path = os.path.join(DATA_DIR, "synthetic_utilization_data.csv")
    df.to_csv(csv_path, index=False)
    print(f"[SmartMed ML] Saved synthetic utilization dataset to {csv_path} ({len(df)} records)")

    X = df[FEATURE_COLUMNS]

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    k = 4
    kmeans = KMeans(n_clusters=k, random_state=42, n_init=15)
    clusters = kmeans.fit_predict(X_scaled)
    df["cluster"] = clusters

    sil_score = float(silhouette_score(X_scaled, clusters))
    print(f"[SmartMed ML] K-Means (k={k}) Silhouette Score: {sil_score:.4f}")

    # Map each K-Means cluster index to the most appropriate semantic profile based on centroid characteristics
    # Cluster with highest operating_hours & low idle -> OVERUTILIZED
    # Cluster with highest idle_ratio -> UNDERUTILIZED
    # Cluster with highest movement_frequency -> HIGH_MOBILITY
    # Remaining cluster -> BALANCED
    cluster_means = df.groupby("cluster")[FEATURE_COLUMNS].mean()
    print("[SmartMed ML] Cluster Means:\n", cluster_means)

    assigned_profiles = {}
    unassigned_clusters = set(range(k))

    # Highest idle ratio = UNDERUTILIZED
    c_under = int(cluster_means["idle_ratio"].idxmax())
    assigned_profiles[c_under] = "UNDERUTILIZED"
    unassigned_clusters.discard(c_under)

    # From remaining, highest operating_hours = OVERUTILIZED
    remaining_means = cluster_means.loc[list(unassigned_clusters)]
    c_over = int(remaining_means["operating_hours"].idxmax())
    assigned_profiles[c_over] = "OVERUTILIZED"
    unassigned_clusters.discard(c_over)

    # From remaining, highest movement_frequency = HIGH_MOBILITY
    remaining_means = cluster_means.loc[list(unassigned_clusters)]
    c_mob = int(remaining_means["movement_frequency_per_month"].idxmax())
    assigned_profiles[c_mob] = "HIGH_MOBILITY"
    unassigned_clusters.discard(c_mob)

    # Last remaining = BALANCED
    c_bal = list(unassigned_clusters)[0]
    assigned_profiles[c_bal] = "BALANCED"

    print("[SmartMed ML] Cluster Semantic Mapping:", assigned_profiles)

    # Build cluster profile summary
    cluster_definitions = {}
    for c_id, profile_key in assigned_profiles.items():
        profile_info = CLUSTER_PROFILES[profile_key]
        c_stats = cluster_means.loc[c_id].to_dict()
        cluster_definitions[str(c_id)] = {
            "cluster_id": c_id,
            "profile_key": profile_key,
            "name": profile_info["name"],
            "description": profile_info["description"],
            "risk_level": profile_info["risk_level"],
            "action_recommendation": profile_info["action_recommendation"],
            "color": profile_info["color"],
            "centroid_benchmarks": {k: round(float(v), 2) for k, v in c_stats.items()},
        }

    pipeline = Pipeline([
        ("scaler", scaler),
        ("kmeans", kmeans),
    ])

    model_path = os.path.join(MODELS_DIR, "utilization_kmeans.joblib")
    joblib.dump(pipeline, model_path)
    print(f"[SmartMed ML] Persisted K-Means pipeline to {model_path}")

    metadata = {
        "model_type": "KMeans",
        "algorithm": "Scikit-learn StandardScaler + KMeans(k=4, n_init=15)",
        "n_clusters": k,
        "silhouette_score": sil_score,
        "feature_columns": FEATURE_COLUMNS,
        "cluster_mapping": {str(k): v for k, v in assigned_profiles.items()},
        "cluster_definitions": cluster_definitions,
        "is_synthetic_trained": True,
        "data_disclosure": "Trained on synthetic clinical device utilization records. Cluster assignments reflect simulated hospital utilization patterns.",
    }

    metrics_path = os.path.join(MODELS_DIR, "utilization_clusters.json")
    with open(metrics_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"[SmartMed ML] Saved cluster metadata to {metrics_path}")

    return pipeline, metadata


if __name__ == "__main__":
    train_and_save_model()
