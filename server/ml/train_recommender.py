"""
SmartMed AI - Clinical Equipment Recommendation Pipeline
Model: Scikit-learn Random Forest Classifier
Target: Learn multi-factor candidate clinical suitability score from feature vectors
Dataset: Synthetic clinical preference decisions (clearly labeled and documented)
"""

import os
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, roc_auc_score, accuracy_score
import joblib

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

FEATURE_COLUMNS = [
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
]


def generate_synthetic_recommendation_dataset(n_samples=2000, random_seed=42):
    """
    Generates domain-grounded synthetic clinical selection scenarios.
    Explicitly labeled as synthetic data.
    """
    np.random.seed(random_seed)

    transit_distance_meters = np.random.uniform(0, 220, size=n_samples)
    estimated_transit_minutes = (transit_distance_meters / 40.0) + np.random.uniform(0, 0.8, size=n_samples)
    battery_level = np.random.uniform(20, 100, size=n_samples)
    is_runtime_verified = np.random.choice([0, 1], size=n_samples, p=[0.25, 0.75])
    verified_runtime_minutes = np.where(
        is_runtime_verified == 1,
        np.random.uniform(45, 300, size=n_samples),
        np.nan_to_num(battery_level * 1.8, nan=60.0)
    )
    operating_hours = np.random.uniform(50, 4200, size=n_samples)
    condition_code = np.random.choice([0, 1, 2], size=n_samples, p=[0.58, 0.30, 0.12])
    urgency_code = np.random.choice([0, 1], size=n_samples, p=[0.40, 0.60])
    capability_match_ratio = np.random.choice([0.7, 0.85, 1.0], size=n_samples, p=[0.1, 0.2, 0.7])
    floor_change_count = np.random.choice([0, 1, 2], size=n_samples, p=[0.55, 0.35, 0.10])

    # Clinical decision rule for synthetic suitability target:
    # In urgent mode: transit speed and battery readiness dominate.
    # In standard mode: verified runtime and condition dominate.
    urgent_score = (
        (1.0 - np.clip(estimated_transit_minutes / 5.0, 0, 1)) * 0.38
        + (battery_level / 100.0) * 0.28
        + (np.clip(verified_runtime_minutes / 240.0, 0, 1)) * 0.14
        + (1.0 - condition_code / 2.0) * 0.10
        + capability_match_ratio * 0.10
    )

    standard_score = (
        (np.clip(verified_runtime_minutes / 240.0, 0, 1)) * 0.32
        + (battery_level / 100.0) * 0.24
        + capability_match_ratio * 0.20
        + (1.0 - np.clip(estimated_transit_minutes / 5.0, 0, 1)) * 0.14
        + (1.0 - condition_code / 2.0) * 0.10
    )

    combined_score = np.where(urgency_code == 1, urgent_score, standard_score)
    noise = np.random.normal(0, 0.06, size=n_samples)
    final_prob = np.clip(combined_score + noise, 0.0, 1.0)
    is_preferred_candidate = (final_prob > 0.58).astype(int)

    df = pd.DataFrame({
        "transit_distance_meters": np.round(transit_distance_meters, 1),
        "estimated_transit_minutes": np.round(estimated_transit_minutes, 1),
        "battery_level": np.round(battery_level, 1),
        "verified_runtime_minutes": np.round(verified_runtime_minutes, 1),
        "operating_hours": np.round(operating_hours, 1),
        "condition_code": condition_code,
        "urgency_code": urgency_code,
        "capability_match_ratio": capability_match_ratio,
        "floor_change_count": floor_change_count,
        "is_runtime_verified": is_runtime_verified,
        "clinical_suitability_score": np.round(final_prob * 100, 1),
        "is_preferred_candidate": is_preferred_candidate,
        "data_source": "SYNTHETIC_SIMULATED_DATA",
    })

    return df


def train_and_save_model():
    print("[SmartMed ML] Generating synthetic equipment recommendation dataset...")
    df = generate_synthetic_recommendation_dataset(n_samples=2200, random_seed=42)

    csv_path = os.path.join(DATA_DIR, "synthetic_recommendation_data.csv")
    df.to_csv(csv_path, index=False)
    print(f"[SmartMed ML] Saved synthetic recommendation dataset to {csv_path} ({len(df)} records)")

    X = df[FEATURE_COLUMNS]
    y = df["is_preferred_candidate"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("classifier", RandomForestClassifier(
            n_estimators=120,
            max_depth=7,
            min_samples_split=4,
            random_state=42,
            class_weight="balanced"
        )),
    ])

    print("[SmartMed ML] Training Random Forest Recommendation Classifier...")
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]

    accuracy = float(accuracy_score(y_test, y_pred))
    auc = float(roc_auc_score(y_test, y_proba))
    report = classification_report(y_test, y_pred, output_dict=True)

    rf_model = pipeline.named_steps["classifier"]
    feature_importances = {
        col: round(float(imp), 4)
        for col, imp in zip(FEATURE_COLUMNS, rf_model.feature_importances_)
    }
    sorted_importances = dict(sorted(feature_importances.items(), key=lambda x: x[1], reverse=True))

    print(f"[SmartMed ML] Recommender Accuracy: {accuracy:.4f}, ROC-AUC: {auc:.4f}")
    print("[SmartMed ML] Recommender Feature Importances:", sorted_importances)

    model_path = os.path.join(MODELS_DIR, "recommender_rf.joblib")
    joblib.dump(pipeline, model_path)
    print(f"[SmartMed ML] Persisted Recommender pipeline to {model_path}")

    metadata = {
        "model_type": "RandomForestClassifier",
        "algorithm": "Scikit-learn Pipeline with StandardScaler and RandomForestClassifier",
        "target": "is_preferred_candidate (Clinical suitability score 0-100 derived from model probability)",
        "feature_columns": FEATURE_COLUMNS,
        "feature_importances": sorted_importances,
        "n_samples": len(df),
        "accuracy": accuracy,
        "roc_auc": auc,
        "classification_report": report,
        "is_synthetic_trained": True,
        "data_disclosure": "Trained on synthetic clinical decision support preference data. Clinical discretion remains mandatory.",
    }

    metrics_path = os.path.join(MODELS_DIR, "recommender_metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"[SmartMed ML] Saved metadata and metrics to {metrics_path}")

    return pipeline, metadata


if __name__ == "__main__":
    train_and_save_model()
