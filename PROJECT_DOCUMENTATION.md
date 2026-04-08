# Sustainable Fertilizer Usage Optimizer — Project Documentation

This document summarizes the **tools**, **algorithms**, and **machine learning** used in the project, plus how the pieces fit together.

---

## 1. Project overview

The application helps users explore **fertilizer recommendations** using:

- A **web interface** (calculator, dashboard, optional login).
- A **Python backend** that serves the site and exposes a **REST API**.
- A **machine learning model** trained on a public **Kaggle** dataset to predict a **fertilizer product class** from soil and environmental inputs.

**Important:** Outputs are for **demonstration and education**. They are **not** a substitute for professional agronomic advice, soil testing, or local extension recommendations.

---

## 2. Tools and technologies

### 2.1 Frontend

| Tool | Role |
|------|------|
| **HTML5** | Page structure (`index.html`, `auth.html`). |
| **CSS3** | Layout and styling (`styles.css`). |
| **JavaScript (ES6+)** | Form handling, API calls, dashboard UI (`script.js`, `dashboard.js`, `auth.js`). |
| **Bootstrap 5.3** | Responsive UI (CDN: CSS + JS bundle). |

### 2.2 Backend and ML (Python)

| Tool / library | Version hint | Role |
|----------------|--------------|------|
| **Python 3** | 3.11+ recommended | Runtime for API and training. |
| **FastAPI** | ≥ 0.109 | REST API, request validation (`pydantic`), CORS, static file hosting. |
| **Uvicorn** | ≥ 0.27 | ASGI server (`uvicorn app:app`). |
| **scikit-learn** | ≥ 1.3 | `RandomForestClassifier`, `LinearRegression`, `Pipeline`, `ColumnTransformer`, `OneHotEncoder`, train/test split, metrics. |
| **pandas** | ≥ 2.0 | Load and prepare tabular data. |
| **joblib** | ≥ 1.3 | Save/load trained pipeline (`fertilizer_clf.pkl`, `fertilizer_meta.pkl`). |
| **kagglehub** | ≥ 0.2 | Download the Kaggle CSV during training (no manual unzip). |
| **pydantic** | ≥ 2.0 | API request/response models. |

### 2.3 Dataset

| Source | Description |
|--------|-------------|
| **Kaggle** — [nishchalchandel/fertilizer-recommendation](https://www.kaggle.com/datasets/nishchalchandel/fertilizer-recommendation) | CSV: `fertilizer_recommendation_dataset.csv` with environmental, soil, crop, nutrient-related fields and a **Fertilizer** label plus **Remark** text. |

### 2.4 DevOps / run

| Item | Purpose |
|------|---------|
| **`run_app.sh`** | Optional training (if model missing), sets `FERTILIZER_FRONTEND_DIR`, starts Uvicorn on port **8000**. |
| **`FERTILIZER_FRONTEND_DIR`** | Env var: folder containing `index.html` (project root). |
| **Single port** | Browser: `http://127.0.0.1:8000/` — same host for HTML/JS and `/api/*` ML endpoints. |

### 2.5 Other features (non-ML)

| Feature | Implementation |
|---------|----------------|
| **Authentication (demo)** | Browser `localStorage` (`auth.js`); not production-grade security. |
| **Dashboard** | Simulated sensors, location/weather UI, crop lists (`dashboard.js`); weather uses an external API key in client code (suitable only for demos). |

---

## 3. Algorithm used (machine learning)

### 3.1 Task type

**Supervised multiclass classification**

- **Input (X):** Seven features from the dataset (after the web form is mapped to the same schema).
- **Output (y):** The **`Fertilizer`** column — one discrete label per row (e.g. DAP, Urea, Balanced NPK Fertilizer, Compost, Lime, …).

### 3.2 Model family

**Random Forest Classifier** (`sklearn.ensemble.RandomForestClassifier`)

- An **ensemble** of decision trees; each tree votes and the forest aggregates votes (majority class).
- Handles **numeric** and **categorical** inputs via a preprocessing **pipeline** (see below).

### 3.3 Preprocessing pipeline

Built with **`sklearn.pipeline.Pipeline`** and **`ColumnTransformer`**:

1. **Numeric columns** (passed through unchanged):  
   `Temperature`, `Moisture`, `Rainfall`, `PH`, `Carbon`
2. **Categorical columns** (one-hot encoded with **`OneHotEncoder`**, `handle_unknown="ignore"`):  
   `Soil`, `Crop`

Then the **Random Forest** operates on the transformed feature matrix.

### 3.4 Key hyperparameters (training script)

| Parameter | Value (typical) | Note |
|-----------|-----------------|------|
| `n_estimators` | 200 | Number of trees. |
| `max_depth` | 24 | Tree depth limit. |
| `min_samples_leaf` | 2 | Minimum samples per leaf. |
| `class_weight` | `balanced_subsample` | Mitigates imbalance across fertilizer classes. |
| `random_state` | 42 | Reproducibility. |
| `n_jobs` | -1 | Use all CPU cores where supported. |

### 3.5 Training procedure

1. Load CSV (via **kagglehub** or `--csv` / `FERTILIZER_CSV`).
2. **Train/test split:** 80% / 20%, **`stratify=y`** to preserve class proportions.
3. **Fit** the full pipeline on the training split.
4. **Evaluate** on the hold-out split: **accuracy**, **per-class precision/recall/F1** (see `models/metrics.json`).
5. **Persist:** `models/fertilizer_clf.pkl`, `models/fertilizer_meta.pkl` (metadata + remark strings per class), `models/metrics.json`.

**Reported hold-out accuracy (example from trained run):** ~**70.8%** overall; per-class performance varies (some classes are rarer or harder to separate).

### 3.6 Inference (prediction at runtime)

1. User submits the calculator form (crop, soil type, area, temperature, water level, soil condition).
2. The API **maps** those fields to dataset-style features (e.g. moisture/rainfall from water level, pH/carbon from soil condition, crop/soil name mapping).
3. The **saved pipeline** predicts:
   - **Class:** recommended fertilizer name  
   - **Confidence:** maximum predicted class probability from `predict_proba`
4. The UI shows the dataset **Remark** for that class when available (from training-time aggregation in `fertilizer_meta.pkl`).

### 3.7 Other ML helpers in the project

**Soil condition from sensors (Random Forest)**  
- **Script:** `backend/train_soil_condition.py` → `models/soil_condition_clf.pkl`.  
- **Inputs:** `soil_moisture_pct`, `humidity_pct` (aligned with the Smart Farming Dashboard readouts).  
- **Output:** `poor` | `fair` | `good` | `excellent`.  
- **Training data:** **Synthetic** — labels are derived from a moisture-heavy score of the two readings plus noise, so the model learns a smooth multiclass boundary (demo correlation, not a field-calibrated soil test).  
- **API:** `POST /api/predict-soil-condition`. The calculator includes a button to **Suggest from dashboard sensors (ML)**.

**USD → INR (spot + ML trend)**  
- **Module:** `backend/fx_ml.py`.  
- **Spot rate:** Latest **USD→INR** from the **Frankfurter** API (ECB data) when the network allows.  
- **ML layer:** **`LinearRegression`** on recent daily rates (day index → INR per USD) to produce a short **trend extrapolation** (`ml_inr_per_usd`). This is for teaching only — not financial or trading advice. If the API fails, a fallback rate is used.  
- **API:** `GET /api/fx/usd-inr`. The results table shows **Cost (₹, spot)** using the spot rate.

---

## 4. What is ML vs. what is not ML

### 4.1 Machine learning (yes)

- **Choosing the fertilizer product class** from the learned Random Forest model, trained on the Kaggle **Fertilizer** labels.
- **Suggesting soil condition** from **humidity + soil moisture** using the dashboard-driven **Random Forest** (`train_soil_condition.py`).
- **ML trend USD→INR** via **LinearRegression** on recent FX history (`fx_ml.py`); **spot** conversion still comes from the live API when available.

### 4.2 Not machine learning (rule-based layer)

- **Nitrogen / phosphorus / potassium kilograms** shown in the cost table are **not** direct model outputs. They come from a **fixed lookup** in the API (`ELEMENTAL_KG_PER_ACRE_BY_PRODUCT` in `backend/app.py`): typical elemental rates **per acre** for each product class, multiplied by **user-entered acreage**. This keeps units interpretable for the UI but should be labeled as **illustrative**, not field-validated prescriptions.

---

## 5. API summary (ML-related)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/health` | Model file present, optional metadata (e.g. hold-out accuracy). |
| `POST` | `/api/predict-npk` | JSON body → predicted fertilizer + confidence + N–P–K kg (lookup × area) + notes. |
| `GET` | `/api/predict-npk` | Hint JSON (use POST) for browsers that open the URL with GET. |
| `GET` | `/api/metrics` | Training metrics JSON after `train.py`. |
| `GET` | `/api/fx/usd-inr` | Spot and ML-trend USD→INR (`fx_ml.py`). |
| `POST` | `/api/predict-soil-condition` | Body: `humidity_pct`, `soil_moisture_pct` → `soil_condition` + confidence. |

Legacy aliases: `GET /health` → redirect to `/api/health`; `POST /predict-npk` → same handler as `/api/predict-npk`.

---

## 6. Repository layout (high level)

```
project root/
  index.html, auth.html, script.js, dashboard.js, styles.css, auth.js
  run_app.sh
  PROJECT_DOCUMENTATION.md
  backend/
    app.py          # FastAPI app, static files, API routes
    train.py                  # Kaggle fertilizer classifier
    train_soil_condition.py  # Sensor → soil_condition classifier
    fx_ml.py                   # Frankfurter spot + LinearRegression trend
    requirements.txt
    models/
      fertilizer_clf.pkl
      fertilizer_meta.pkl
      soil_condition_clf.pkl
      metrics.json
```

---

## 7. How to run (short)

```bash
./run_app.sh
```

Open **http://127.0.0.1:8000/** — calculator calls **`POST /api/predict-npk`** on the same origin.

Retrain after data or code changes:

```bash
cd backend && python train.py
python train_soil_condition.py   # soil-sensor model
```

---

## 8. Limitations and ethics

- Model quality is bounded by the **dataset** (synthetic or curated scenarios, possible noise, class imbalance).
- **N–P–K kg** are **demo scalings**, not calibrated to your farm’s soil tests.
- **Weather API key** in client-side JS is insecure for production; use a backend proxy and secrets management in real deployments.
- **Auth** via `localStorage` is for prototyping only.

---

*Document generated to match the current codebase. Update this file if you change models, APIs, or the dataset.*
