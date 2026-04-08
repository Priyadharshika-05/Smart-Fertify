"""
Train a RandomForestClassifier mapping sensor-style readings to soil_condition
(poor | fair | good | excellent).

Training data is synthetic: labels derive from a moisture-heavy score plus noise,
so the model learns a smooth boundary similar to agronomic intuition (wetter +
balanced air humidity often aligns with better apparent soil status in this demo).
"""

from __future__ import annotations

import argparse
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

ROOT = Path(__file__).resolve().parent
MODEL_DIR = ROOT / "models"
OUT_PATH = MODEL_DIR / "soil_condition_clf.pkl"

RANDOM_STATE = 42


def build_synthetic_dataset(n_samples: int = 4000, seed: int = RANDOM_STATE) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    soil_moisture = rng.uniform(12.0, 96.0, n_samples)
    humidity = rng.uniform(22.0, 96.0, n_samples)
    # Moisture contributes more than humidity to perceived soil vitality (demo prior).
    score = 0.62 * soil_moisture + 0.38 * humidity
    score = score + rng.normal(0.0, 9.0, n_samples)
    score = np.clip(score, 0.0, 100.0)

    cond = np.full(n_samples, "fair", dtype=object)
    cond[score < 42.0] = "poor"
    cond[(score >= 42.0) & (score < 58.0)] = "fair"
    cond[(score >= 58.0) & (score < 76.0)] = "good"
    cond[score >= 76.0] = "excellent"

    return pd.DataFrame(
        {
            "soil_moisture_pct": soil_moisture,
            "humidity_pct": humidity,
            "soil_condition": cond,
        }
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples", type=int, default=4000)
    args = parser.parse_args()

    df = build_synthetic_dataset(args.samples)
    X = df[["soil_moisture_pct", "humidity_pct"]]
    y = df["soil_condition"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
    )

    pipe = Pipeline(
        [
            (
                "clf",
                RandomForestClassifier(
                    n_estimators=80,
                    max_depth=8,
                    min_samples_leaf=4,
                    class_weight="balanced",
                    random_state=RANDOM_STATE,
                    n_jobs=-1,
                ),
            )
        ]
    )
    pipe.fit(X_train, y_train)
    y_pred = pipe.predict(X_test)
    print(classification_report(y_test, y_pred, zero_division=0))

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    meta = {
        "features": ["soil_moisture_pct", "humidity_pct"],
        "classes": list(pipe.named_steps["clf"].classes_),
        "task": "soil_condition_from_sensors",
    }
    joblib.dump({"pipeline": pipe, "meta": meta}, OUT_PATH)
    print(f"Saved {OUT_PATH}")


if __name__ == "__main__":
    main()
