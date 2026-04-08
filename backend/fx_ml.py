"""
USD → INR: spot rate from Frankfurter API + ML-smoothed estimate (Linear Regression
on recent daily USD/INR). Exchange rates are not inherently "predictable"; the
regression is a teaching demo of fitting a short trend, not financial advice.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import date, timedelta

import numpy as np
from sklearn.linear_model import LinearRegression


def frankfurter_spot_inr(timeout: float = 12.0) -> float:
    url = "https://api.frankfurter.app/v1/latest?from=USD&to=INR"
    with urllib.request.urlopen(url, timeout=timeout) as r:
        data = json.loads(r.read().decode())
    return float(data["rates"]["INR"])


def frankfurter_history_inr(days: int = 75, timeout: float = 15.0) -> list[float]:
    end = date.today()
    start = end - timedelta(days=max(days, 10))
    url = f"https://api.frankfurter.app/v1/{start.isoformat()}..{end.isoformat()}?from=USD&to=INR"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            data = json.loads(r.read().decode())
    except (urllib.error.URLError, OSError, ValueError, json.JSONDecodeError):
        return []
    rates = data.get("rates") or {}
    out: list[float] = []
    for d in sorted(rates.keys()):
        inner = rates[d]
        if isinstance(inner, dict) and "INR" in inner:
            out.append(float(inner["INR"]))
    return out


def ml_trend_inr_per_usd(series: list[float]) -> float | None:
    """Extrapolate one step with OLS on day index — demo ML layer only."""
    if len(series) < 7:
        return None
    X = np.arange(len(series), dtype=float).reshape(-1, 1)
    y = np.asarray(series, dtype=float)
    reg = LinearRegression()
    reg.fit(X, y)
    return float(reg.predict(np.array([[float(len(series))]]))[0])


def get_usd_inr_bundle(default_inr_if_api_fails: float = 83.0) -> dict:
    try:
        spot = frankfurter_spot_inr()
    except (urllib.error.URLError, OSError, ValueError, json.JSONDecodeError, KeyError):
        spot = default_inr_if_api_fails
        hist: list[float] = []
        ml_rate = None
    else:
        hist = frankfurter_history_inr()
        ml_rate = ml_trend_inr_per_usd(hist)
    if ml_rate is None or ml_rate <= 0 or ml_rate > 200:
        ml_rate = float(spot)
    return {
        "spot_inr_per_usd": round(float(spot), 4),
        "ml_inr_per_usd": round(float(ml_rate), 4),
        "history_days_used": len(hist),
        "ml_model": "LinearRegression (day index → INR per 1 USD)",
        "note": "Spot rate is live from Frankfurter (ECB). ML value is a short trend extrapolation for demo only.",
    }
