# Fertilizer ML API

## What the model does

- **Task:** `RandomForestClassifier` predicts the dataset’s **`Fertilizer`** label from temperature, moisture, rainfall, pH, carbon, soil type, and crop (same signal family as the CSV).
- **N–P–K table:** Elemental kg for the UI come from **fixed typical rates per product class** (agronomy-style layer), scaled by your acreage—not from a second mystery regression.

## Dataset

- **Kaggle:** [nishchalchandel/fertilizer-recommendation](https://www.kaggle.com/datasets/nishchalchandel/fertilizer-recommendation)
- **Download:** `train.py` pulls the CSV via [kagglehub](https://github.com/Kaggle/kagglehub) (no manual unzip needed).

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Train

```bash
python train.py
```

Optional: `python train.py --csv /path/to/fertilizer_recommendation_dataset.csv`

Artifacts: `models/fertilizer_clf.pkl`, `models/fertilizer_meta.pkl`, `models/metrics.json`.

## Run web + ML together (recommended)

From the **project root** (parent of `backend/`):

```bash
chmod +x run_app.sh   # once
./run_app.sh
```

Open **http://127.0.0.1:8000** — FastAPI serves the static HTML/JS **and** the ML API under **`/api`** (e.g. `POST /api/predict-npk`) on the same origin (no CORS, no second port).

## Run API only (advanced)

```bash
cd backend
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

If you instead serve files with `python3 -m http.server` on another port, the UI will call `http://<same-host>:8000` automatically. Override with:

```html
<script>window.ML_API_BASE = 'http://127.0.0.1:8000';</script>
```

before `script.js` if needed.

## Note

The **product choice** is ML from Kaggle labels; **nutrient kg** are illustrative defaults per product. Always validate with soil tests and local extension guidance.

`GET /metrics` returns hold-out accuracy and a classification report after training.
