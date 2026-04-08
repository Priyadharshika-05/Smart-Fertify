#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export FERTILIZER_FRONTEND_DIR="$ROOT"
cd "$ROOT/backend"
if [[ ! -f models/fertilizer_clf.pkl ]]; then
  echo "Training fertilizer ML model (first run)…"
  python3 train.py
fi
if [[ ! -f models/soil_condition_clf.pkl ]]; then
  echo "Training soil-sensor ML model (first run)…"
  python3 train_soil_condition.py
fi
echo ""
echo "  → Open in your browser:  http://127.0.0.1:8000"
echo "  → ML API + web UI on the same port (no separate static server)."
echo ""
exec python3 -m uvicorn app:app --host 127.0.0.1 --port 8000
