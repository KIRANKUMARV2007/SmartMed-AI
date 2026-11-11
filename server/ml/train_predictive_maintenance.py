"""
SmartMed AI - Predictive Maintenance Training Pipeline
Model: Scikit-learn Random Forest Classifier
Target: Predict probability of equipment failure / required servicing within next 30 days
Dataset: Synthetic biomedical telemetry dataset (clearly labeled and documented)
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

CATEGORIES = [
    "Ventilator",
    "Defibrillator",
    "Infusion Pump",
    "Portable Ultrasound",
    "ECG Machine",
    "Patient Monitor",
    "Transport Wheelchair",
]

CATEGORY_MAP = {cat: i for i, cat in enumerate(CATEGORIES)}
CONDITION_MAP = {"Optimal": 0, "Good": 1, "Fair": 2}

FEATURE_COLUMNS = [
    "operating_hours",
    "battery_level",
    "battery_wear_cycles",
    "days_since_last_sanitization",
    "days_until_scheduled_maintenance",
    "condition_code",
    "category_code",
    "avg_daily_usage_hours",
    "historical_fault_count",
]


def generate_synthetic_maintenance_dataset(n_samples=1500, random_seed=42):
    """
    Generates a domain-grounded synthetic dataset representing biomedical fleet equipment.
    Synthetic nature is explicitly labeled in every output file.
    """
    np.random.seed(random_seed)

    operating_hours = np.random.uniform(50, 4800, size=n_samples)
    battery_level = np.random.uniform(15, 100, size=n_samples)
    battery_wear_cycles = np.random.uniform(10, 650, size=n_samples)
    days_since_last_sanitization = np.random.uniform(0.5, 45, size=n_samples)
    days_until_scheduled_maint = np.random.uniform(-40, 150, size=n_samples)
    condition_code = np.random.choice([0, 1, 2], size=n_samples, p=[0.55, 0.32, 0.13])
    category_code = np.random.choice(len(CATEGORIES), size=n_samples)
    avg_daily_usage_hours = np.random.uniform(2.0, 16.0, size=n_samples)
    historical_fault_count = np.random.poisson(lam=0.8, size=n_samples)

    # Biomedical degradation ground truth rule for synthetic target
    # Probability of requiring maintenance in next 30 days increases with:
    # 1. Very high operating hours (> 2500h)
    # 2. Past or near scheduled maintenance (< 14 days)
    # 3. Fair condition / repeated faults
    # 4. High battery wear cycles (> 400 cycles) + low charge
    risk_score = (
        (operating_hours / 4800.0) * 0.30
        + np.where(days_until_scheduled_maint <= 14, 0.25, 0.0)
        + np.where(days_until_scheduled_maint <= 0, 0.15, 0.0)  # Overdue
        + (condition_code / 2.0) * 0.20
        + (historical_fault_count / 5.0) * 0.15
        + (battery_wear_cycles / 650.0) * 0.10
        + np.where(battery_level < 30, 0.10, 0.0)
    )

    # Add realistic stochastic noise
    noise = np.random.normal(0, 0.08, size=n_samples)
    final_prob = np.clip(risk_score + noise, 0.0, 1.0)
    failure_next_30d = (final_prob > 0.48).astype(int)

    df = pd.DataFrame({
        "operating_hours": np.round(operating_hours, 1),
        "battery_level": np.round(battery_level, 1),
        "battery_wear_cycles": np.round(battery_wear_cycles, 0),
        "days_since_last_sanitization": np.round(days_since_last_sanitization, 1),
        "days_until_scheduled_maintenance": np.round(days_until_scheduled_maint, 1),
        "condition_code": condition_code,
        "category_code": category_code,
        "avg_daily_usage_hours": np.round(avg_daily_usage_hours, 1),
        "historical_fault_count": historical_fault_count,
        "failure_risk_probability": np.round(final_prob, 3),
        "failure_next_30d": failure_next_30d,
        "data_source": "SYNTHETIC_SIMULATED_DATA",
    })

    return df


def train_and_save_model():
    print("[SmartMed ML] Generating synthetic predictive maintenance dataset...")
    df = generate_synthetic_maintenance_dataset(n_samples=1600, random_seed=42)

    csv_path = os.path.join(DATA_DIR, "synthetic_maintenance_data.csv")
    df.to_csv(csv_path, index=False)
    print(f"[SmartMed ML] Saved synthetic dataset to {csv_path} ({len(df)} records)")

    X = df[FEATURE_COLUMNS]
    y = df["failure_next_30d"]

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

    print("[SmartMed ML] Training Random Forest Predictive Maintenance Classifier...")
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
    # Sort by importance descending
    sorted_importances = dict(sorted(feature_importances.items(), key=lambda x: x[1], reverse=True))

    print(f"[SmartMed ML] Model Accuracy: {accuracy:.4f}, ROC-AUC: {auc:.4f}")
    print("[SmartMed ML] Feature Importances:", sorted_importances)

    model_path = os.path.join(MODELS_DIR, "predictive_maintenance_rf.joblib")
    joblib.dump(pipeline, model_path)
    print(f"[SmartMed ML] Persisted pipeline to {model_path}")

    metadata = {
        "model_type": "RandomForestClassifier",
        "algorithm": "Scikit-learn Pipeline with StandardScaler and RandomForestClassifier",
        "target": "failure_next_30d (Probability of equipment failure or required maintenance in next 30 days)",
        "feature_columns": FEATURE_COLUMNS,
        "feature_importances": sorted_importances,
        "n_samples": len(df),
        "accuracy": accuracy,
        "roc_auc": auc,
        "classification_report": report,
        "is_synthetic_trained": True,
        "data_disclosure": "Trained on domain-modeled synthetic clinical equipment degradation data. Real-world validation required before clinical deployment.",
        "categories": CATEGORIES,
    }

    metrics_path = os.path.join(MODELS_DIR, "predictive_maintenance_metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"[SmartMed ML] Saved metadata and metrics to {metrics_path}")

    return pipeline, metadata


if __name__ == "__main__":
    train_and_save_model()
