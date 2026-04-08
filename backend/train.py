"""
Train RandomForestClassifier: predict recommended Fertilizer from
Temperature, Moisture, Rainfall, PH, Carbon, Soil, Crop.

Dataset CSV is bundled in the repo at backend/data/fertilizer_recommendation_dataset.csv
so no Kaggle credentials are needed.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

ROOT = Path(__file__).resolve().parent
MODEL_DIR = ROOT / "models"
DATA_DIR  = ROOT / "data"
CSV_NAME  = "fertilizer_recommendation_dataset.csv"
DATASET_SLUG = "nishchalchandel/fertilizer-recommendation"

FEATURES = ["Temperature", "Moisture", "Rainfall", "PH", "Carbon", "Soil", "Crop"]
TARGET = "Fertilizer"
REMARK_COL = "Remark"


def resolve_csv_path(explicit: str | None) -> Path:
    # 1. Explicit CLI arg
    if explicit:
        p = Path(explicit)
        if not p.is_file():
            raise FileNotFoundError(f"CSV not found: {explicit}")
        return p
    # 2. Environment variable override
    env = os.environ.get("FERTILIZER_CSV")
    if env and Path(env).is_file():
        return Path(env)
    # 3. Bundled in repo at backend/data/
    bundled = DATA_DIR / CSV_NAME
    if bundled.is_file():
        return bundled
    raise FileNotFoundError(
        f"Dataset CSV not found. Expected at: {bundled}\n"
        f"Place the CSV at backend/data/{CSV_NAME} or set the FERTILIZER_CSV env var."
    )


def build_pipeline() -> Pipeline:
    pre = ColumnTransformer(
        [
            (
                "num",
                "passthrough",
                ["Temperature", "Moisture", "Rainfall", "PH", "Carbon"],
            ),
            ("cat", OneHotEncoder(handle_unknown="ignore"), ["Soil", "Crop"]),
        ]
    )
    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=24,
        min_samples_leaf=2,
        class_weight="balanced_subsample",
        random_state=42,
        n_jobs=-1,
    )
    return Pipeline([("prep", pre), ("clf", clf)])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", type=str, default=None, help="Path to CSV (optional)")
    args = parser.parse_args()

    csv_path = resolve_csv_path(args.csv)
    print(f"Using dataset: {csv_path}")
    df = pd.read_csv(csv_path)
    missing = [c for c in FEATURES + [TARGET] if c not in df.columns]
    if missing:
        raise ValueError(f"CSV missing columns: {missing}")

    X = df[FEATURES].copy()
    y = df[TARGET].astype(str)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    pipe = build_pipeline()
    pipe.fit(X_train, y_train)
    y_pred = pipe.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"Hold-out accuracy: {acc:.4f}")
    print(classification_report(y_test, y_pred, zero_division=0))

    remark_by_class: dict[str, str] = {}
    if REMARK_COL in df.columns:
        for name, sub in df.groupby(TARGET, observed=False):
            modes = sub[REMARK_COL].mode()
            remark_by_class[str(name)] = (
                str(modes.iloc[0]) if len(modes) else str(sub[REMARK_COL].iloc[0])
            )

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, MODEL_DIR / "fertilizer_clf.pkl")
    meta = {
        "dataset": DATASET_SLUG,
        "csv_used": str(csv_path),
        "task": "classification",
        "target": TARGET,
        "features": FEATURES,
        "holdout_accuracy": float(acc),
        "n_classes": int(y.nunique()),
        "classes": sorted(y.unique().tolist()),
        "remark_by_class": remark_by_class,
    }
    joblib.dump(meta, MODEL_DIR / "fertilizer_meta.pkl")
    report = classification_report(y_test, y_pred, zero_division=0, output_dict=True)
    with open(MODEL_DIR / "metrics.json", "w", encoding="utf-8") as f:
        json.dump({"holdout_accuracy": float(acc), "classification_report": report}, f, indent=2, default=str)
    print(f"Saved {MODEL_DIR / 'fertilizer_clf.pkl'} and meta.")

    # Remove legacy artifact names if present (avoid loading wrong model)
    for legacy in ("npk_pipeline.pkl", "npk_meta.pkl"):
        lp = MODEL_DIR / legacy
        if lp.is_file():
            lp.unlink()
            print(f"Removed legacy {lp.name}")


if __name__ == "__main__":
    main()
