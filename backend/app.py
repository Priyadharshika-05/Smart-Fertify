"""
SmartFertify API v3.1
- FastAPI + MongoDB Atlas (motor async)
- User auth (register / login / HMAC token)
- Fertilizer price fetching from fert.nic.in (cached daily in MongoDB)
- Analysis history stored per user in MongoDB
- ML: RandomForest fertilizer classifier
- Blynk IoT sensor proxy (v3.1)
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time as _time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx
import joblib
import pandas as pd
from bson import ObjectId
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

# ─────────────────────────────────────────────────────────────────────────────
# TOKEN AUTH (HMAC — no extra JWT lib needed)
# ─────────────────────────────────────────────────────────────────────────────
JWT_SECRET = os.environ.get("JWT_SECRET", "smartfertify-secret-key-2024")
TOKEN_TTL  = 60 * 60 * 24 * 7   # 7 days in seconds


def make_token(user_id: str, email: str) -> str:
    payload = f"{user_id}|{email}|{int(_time.time()) + TOKEN_TTL}"
    sig = hmac.new(JWT_SECRET.encode(), payload.encode(), "sha256").hexdigest()
    return base64.urlsafe_b64encode(f"{payload}|{sig}".encode()).decode()


def verify_token(token: str) -> dict | None:
    try:
        raw   = base64.urlsafe_b64decode(token.encode()).decode()
        *parts, sig = raw.split("|")
        payload = "|".join(parts)
        expected = hmac.new(JWT_SECRET.encode(), payload.encode(), "sha256").hexdigest()
        if not secrets.compare_digest(sig, expected):
            return None
        uid, email, exp = parts
        if int(exp) < int(_time.time()):
            return None
        return {"user_id": uid, "email": email}
    except Exception:
        return None


# ─────────────────────────────────────────────────────────────────────────────
# MONGODB  ← URI comes ONLY from environment variable (never hardcoded)
# ─────────────────────────────────────────────────────────────────────────────
MONGO_URI = os.environ.get("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError(
        "MONGO_URI environment variable is not set. "
        "Add it in your Render dashboard → Environment."
    )
DB_NAME = "agrios"
_mongo_client: AsyncIOMotorClient | None = None


def get_db():
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = AsyncIOMotorClient(MONGO_URI)
    return _mongo_client[DB_NAME]


# ─────────────────────────────────────────────────────────────────────────────
# STATIC MAPS
# ─────────────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent
CLF_PATH         = ROOT / "models" / "fertilizer_clf.pkl"
META_PATH        = ROOT / "models" / "fertilizer_meta.pkl"
SOIL_SENSOR_PATH = ROOT / "models" / "soil_condition_clf.pkl"

SOIL_TYPE_MAP = {"loamy": "Loamy Soil", "sandy": "Neutral Soil", "clay": "Peaty Soil"}
CROP_MAP      = {"wheat": "wheat", "rice": "rice", "corn": "maize", "soybean": "Chickpea"}

WATER_TO_MOISTURE  = {"low": 0.42, "medium": 0.72, "high": 0.88}
WATER_TO_RAINFALL  = {"low": 175.0, "medium": 235.0, "high": 295.0}
CONDITION_TO_PH_CARBON = {
    "poor":      (5.85, 0.85),
    "fair":      (6.35, 1.25),
    "good":      (6.85, 1.55),
    "excellent": (7.25, 2.05),
}

CROP_SOIL_COMPAT = {
    "rice":    {
        "clay":  ("ok",      ""),
        "sandy": ("invalid", "Rice needs water-retaining soil. Sandy drains too fast."),
        "loamy": ("warning", "Rice can grow in loamy soil but clay is preferred."),
    },
    "wheat":   {
        "clay":  ("warning", "Wheat in clay may face waterlogging — ensure drainage."),
        "sandy": ("warning", "Wheat prefers loamy soil; sandy drains too quickly."),
        "loamy": ("ok",      ""),
    },
    "corn":    {
        "clay":  ("warning", "Corn tolerates clay but may suffer poor aeration."),
        "sandy": ("warning", "Corn prefers loamy; sandy needs extra irrigation."),
        "loamy": ("ok",      ""),
    },
    "soybean": {
        "clay":  ("warning", "Soybean in clay — root development may be restricted."),
        "sandy": ("invalid", "Soybean cannot thrive in sandy soil."),
        "loamy": ("ok",      ""),
    },
}

ELEMENTAL_KG_PER_ACRE: dict[str, tuple[float, float, float]] = {
    "Urea":                       (42.0,  0.0,  0.0),
    "DAP":                        (10.0, 22.0,  0.0),
    "Balanced NPK Fertilizer":    (22.0, 14.0, 14.0),
    "Muriate of Potash":          ( 0.0,  0.0, 32.0),
    "Water Retaining Fertilizer": (16.0, 10.0, 10.0),
    "Compost":                    (10.0,  8.0, 10.0),
    "Organic Fertilizer":         (12.0,  9.0,  9.0),
    "General Purpose Fertilizer": (18.0, 12.0, 12.0),
    "Lime":                       ( 0.0,  0.0,  0.0),
    "Gypsum":                     ( 0.0,  0.0,  0.0),
}


# ─────────────────────────────────────────────────────────────────────────────
# BLYNK IoT SENSOR PROXY
# ─────────────────────────────────────────────────────────────────────────────
BLYNK_TOKEN = os.environ.get("BLYNK_TOKEN", "HD8tjeopbOjZb--7aS6sD-f74wkf5UDA")

# Map field names to Blynk virtual pins — override via env vars if needed
BLYNK_PIN_MAP = {
    "temperature": os.environ.get("BLYNK_PIN_TEMP",     "V1"),
    "moisture":    os.environ.get("BLYNK_PIN_MOISTURE",  "V3"),
    "humidity":    os.environ.get("BLYNK_PIN_HUMIDITY",  "V0"),
}


# ─────────────────────────────────────────────────────────────────────────────
# FERTILIZER PRICE FETCHER  (fert.nic.in — daily cache in MongoDB)
# ─────────────────────────────────────────────────────────────────────────────
GAZETTE_PRICES = {
    "urea": {"price_per_bag": 266.50, "kg_per_bag": 45.0, "nutrient_pct": 0.46,
             "source": "fert.nic.in (NBS gazette 2024)"},
    "dap":  {"price_per_bag": 1350.0, "kg_per_bag": 50.0, "nutrient_pct": 0.18,
             "source": "fert.nic.in (NBS gazette 2024)"},
    "mop":  {"price_per_bag": 1655.0, "kg_per_bag": 50.0, "nutrient_pct": 0.60,
             "source": "fert.nic.in (NBS gazette 2024)"},
}


async def _scrape_fert_prices() -> dict:
    prices = {k: dict(v) for k, v in GAZETTE_PRICES.items()}
    now_iso = datetime.now(timezone.utc).isoformat()
    for p in prices.values():
        p["fetched_at"] = now_iso

    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            resp = await client.get(
                "https://www.fert.nic.in/fertilizer-mrp",
                headers={"User-Agent": "Mozilla/5.0 SmartFertify/3.0"}
            )
            text = resp.text.lower()

            m = re.search(r'urea[^₹\d]{0,60}([\d,]+\.?\d{0,2})\s*/?\\s*(?:bag|45\s*kg)', text)
            if m:
                prices["urea"]["price_per_bag"] = float(m.group(1).replace(",", ""))
                prices["urea"]["source"] = "fert.nic.in (live scrape)"

            m = re.search(r'dap[^₹\d]{0,60}([\d,]+\.?\d{0,2})\s*/?\\s*(?:bag|50\s*kg)', text)
            if m:
                prices["dap"]["price_per_bag"] = float(m.group(1).replace(",", ""))
                prices["dap"]["source"] = "fert.nic.in (live scrape)"

            m = re.search(r'mop[^₹\d]{0,60}([\d,]+\.?\d{0,2})\s*/?\\s*(?:bag|50\s*kg)', text)
            if m:
                prices["mop"]["price_per_bag"] = float(m.group(1).replace(",", ""))
                prices["mop"]["source"] = "fert.nic.in (live scrape)"

    except Exception as e:
        for p in prices.values():
            p["source"] = f"fert.nic.in (gazette — live fetch failed: {type(e).__name__})"

    return prices


async def get_fertilizer_prices() -> dict:
    db    = get_db()
    cache = await db.price_cache.find_one({"_id": "fertilizer_prices"})
    now   = datetime.now(timezone.utc)

    if cache and "fetched_at" in cache:
        fa = cache["fetched_at"]
        if isinstance(fa, str):
            fa = datetime.fromisoformat(fa)
        if not fa.tzinfo:
            fa = fa.replace(tzinfo=timezone.utc)
        age_seconds = (now - fa).total_seconds()
        if age_seconds < 86_400:
            return cache["prices"]

    prices = await _scrape_fert_prices()
    await db.price_cache.replace_one(
        {"_id": "fertilizer_prices"},
        {"_id": "fertilizer_prices", "prices": prices, "fetched_at": now},
        upsert=True,
    )
    return prices


# ─────────────────────────────────────────────────────────────────────────────
# BUDGET CALCULATOR
# ─────────────────────────────────────────────────────────────────────────────
def compute_budget_plan(n_need: float, p_need: float, k_need: float,
                        budget_inr: float, prices: dict) -> dict:
    remaining = budget_inr
    N_PER_BAG = prices["urea"]["kg_per_bag"] * prices["urea"]["nutrient_pct"]
    P_PER_BAG = prices["dap"]["kg_per_bag"]  * prices["dap"]["nutrient_pct"]
    K_PER_BAG = prices["mop"]["kg_per_bag"]  * prices["mop"]["nutrient_pct"]
    UREA_P    = prices["urea"]["price_per_bag"]
    DAP_P     = prices["dap"]["price_per_bag"]
    MOP_P     = prices["mop"]["price_per_bag"]

    def alloc(need, per_bag, price_bag):
        nonlocal remaining
        bags_need = need / per_bag if per_bag > 0 else 0
        cost_full = bags_need * price_bag
        if cost_full <= remaining:
            remaining -= cost_full
            return bags_need, cost_full
        bags = remaining / price_bag
        cost = bags * price_bag
        remaining = 0.0
        return bags, cost

    ub, uc = alloc(n_need, N_PER_BAG, UREA_P)
    db_, dc = alloc(p_need, P_PER_BAG, DAP_P)
    mb, mc = alloc(k_need, K_PER_BAG, MOP_P)

    aN, aP, aK   = ub * N_PER_BAG, db_ * P_PER_BAG, mb * K_PER_BAG
    total_need   = n_need + p_need + k_need
    total_actual = aN + aP + aK
    coverage     = (total_actual / total_need * 100) if total_need > 0 else 100.0
    total_cost   = uc + dc + mc

    if coverage >= 99:
        note, nc = "✅ Your budget fully covers the agronomic requirement.", "ok"
    elif coverage >= 70:
        note, nc = f"⚠️ Budget covers {coverage:.0f}% of need. Consider increasing budget.", "warning"
    else:
        note, nc = f"❌ Budget covers only {coverage:.0f}% of need. Nitrogen (Urea) prioritised first.", "danger"

    return dict(
        budget_nitrogen_kg=round(aN, 2),   budget_phosphorus_kg=round(aP, 2),
        budget_potassium_kg=round(aK, 2),  budget_urea_bags=round(ub, 2),
        budget_dap_bags=round(db_, 2),     budget_mop_bags=round(mb, 2),
        budget_urea_cost=round(uc, 2),     budget_dap_cost=round(dc, 2),
        budget_mop_cost=round(mc, 2),      budget_total_cost=round(total_cost, 2),
        budget_remaining=round(remaining, 2), budget_coverage_pct=round(coverage, 1),
        budget_note=note, budget_note_class=nc,
    )


# ─────────────────────────────────────────────────────────────────────────────
# ML HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def load_model():
    if not CLF_PATH.is_file():
        return None, None
    return joblib.load(CLF_PATH), (joblib.load(META_PATH) if META_PATH.is_file() else {})

def hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


# ─────────────────────────────────────────────────────────────────────────────
# PYDANTIC MODELS
# ─────────────────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=2)
    email:    str
    password: str = Field(..., min_length=6)

class LoginRequest(BaseModel):
    email:    str
    password: str

class AuthResponse(BaseModel):
    token:    str
    username: str
    email:    str
    message:  str

class PredictRequest(BaseModel):
    crop:          str   = Field(..., description="wheat | rice | corn | soybean")
    soil_type:     str   = Field(..., description="clay | sandy | loamy")
    area_acres:    float = Field(..., gt=0)
    temperature_c: float
    water_level:   str   = Field(..., description="low | medium | high")
    soil_condition:str   = Field(..., description="poor | fair | good | excellent")
    budget_inr:    float = Field(0.0, ge=0)

class PredictResponse(BaseModel):
    fertilizer_recommended: str
    confidence: float
    remark: Optional[str]
    nitrogen_kg: float
    phosphorus_kg: float
    potassium_kg: float
    price_urea_per_bag:  float
    price_dap_per_bag:   float
    price_mop_per_bag:   float
    price_source:        str
    price_fetched_at:    str
    agro_urea_bags:  float
    agro_dap_bags:   float
    agro_mop_bags:   float
    agro_urea_cost:  float
    agro_dap_cost:   float
    agro_mop_cost:   float
    agro_total_cost: float
    budget_inr:          Optional[float] = None
    budget_nitrogen_kg:  Optional[float] = None
    budget_phosphorus_kg:Optional[float] = None
    budget_potassium_kg: Optional[float] = None
    budget_urea_bags:    Optional[float] = None
    budget_dap_bags:     Optional[float] = None
    budget_mop_bags:     Optional[float] = None
    budget_urea_cost:    Optional[float] = None
    budget_dap_cost:     Optional[float] = None
    budget_mop_cost:     Optional[float] = None
    budget_total_cost:   Optional[float] = None
    budget_remaining:    Optional[float] = None
    budget_coverage_pct: Optional[float] = None
    budget_note:         Optional[str]   = None
    budget_note_class:   Optional[str]   = None
    model:            str
    holdout_accuracy: Optional[float]
    dataset:          str
    note:             str
    soil_compatibility_status:  Optional[str] = None
    soil_compatibility_message: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# FASTAPI APP
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(title="SmartFertify API", version="3.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api    = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    if not creds:
        raise HTTPException(401, "Not authenticated")
    data = verify_token(creds.credentials)
    if not data:
        raise HTTPException(401, "Invalid or expired token")
    return data


def optional_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    if not creds:
        return None
    return verify_token(creds.credentials)


# ─────────────────────────────────────────────────────────────────────────────
# AUTH ROUTES
# ─────────────────────────────────────────────────────────────────────────────
@api.post("/auth/register", response_model=AuthResponse)
async def register(body: RegisterRequest):
    db = get_db()
    if await db.users.find_one({"email": body.email.lower().strip()}):
        raise HTTPException(400, "Email already registered")
    doc = {
        "username":   body.username.strip(),
        "email":      body.email.lower().strip(),
        "password":   hash_password(body.password),
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(doc)
    token  = make_token(str(result.inserted_id), doc["email"])
    return AuthResponse(token=token, username=doc["username"],
                        email=doc["email"], message="Registration successful")


@api.post("/auth/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    db   = get_db()
    user = await db.users.find_one({"email": body.email.lower().strip()})
    if not user or user["password"] != hash_password(body.password):
        raise HTTPException(401, "Invalid email or password")
    token = make_token(str(user["_id"]), user["email"])
    return AuthResponse(token=token, username=user["username"],
                        email=user["email"], message="Login successful")


@api.get("/auth/me")
async def me(current_user=Depends(get_current_user)):
    db   = get_db()
    user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user:
        raise HTTPException(404, "User not found")
    return {
        "username":   user["username"],
        "email":      user["email"],
        "created_at": str(user.get("created_at", "")),
    }


# ─────────────────────────────────────────────────────────────────────────────
# BLYNK IoT SENSOR PROXY ROUTE
# ─────────────────────────────────────────────────────────────────────────────
@api.get("/blynk-readings")
async def blynk_readings():
    """
    Proxies Blynk IoT sensor data to avoid CORS issues from the browser.
    Returns temperature, moisture, humidity from the configured virtual pins.
    """
    if not BLYNK_TOKEN:
        raise HTTPException(503, "BLYNK_TOKEN not configured.")

    results: dict = {}
    async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
        for field, pin in BLYNK_PIN_MAP.items():
            try:
                url = f"https://blynk.cloud/external/api/get?token={BLYNK_TOKEN}&pin={pin}"
                r = await client.get(url)
                r.raise_for_status()
                val = r.text.strip()
                results[field] = round(float(val), 2)
            except Exception as e:
                results[field] = None
                results[f"{field}_error"] = str(e)

    results["connected"] = all(results.get(k) is not None for k in BLYNK_PIN_MAP)
    results["fetched_at"] = datetime.now(timezone.utc).isoformat()
    return results


# ─────────────────────────────────────────────────────────────────────────────
# PRICES ROUTE
# ─────────────────────────────────────────────────────────────────────────────
@api.get("/prices")
async def get_prices():
    prices = await get_fertilizer_prices()
    return {
        "prices": prices,
        "note": "Prices sourced from fert.nic.in, cached daily. MRP per bag as per NBS gazette.",
    }


# ─────────────────────────────────────────────────────────────────────────────
# PREDICTION ROUTE
# ─────────────────────────────────────────────────────────────────────────────
@api.post("/predict-npk", response_model=PredictResponse)
async def predict_npk(body: PredictRequest,
                      current_user=Depends(optional_user)):
    pipe, meta = load_model()
    if pipe is None:
        raise HTTPException(503, "Model not found. Run: python train.py")

    crop_key = body.crop.lower().strip()
    soil_key = body.soil_type.lower().strip()

    rules     = CROP_SOIL_COMPAT.get(crop_key, {})
    cs_status, cs_msg = rules.get(soil_key, ("ok", ""))
    if cs_status == "invalid":
        raise HTTPException(422, detail={
            "error": "Incompatible crop–soil combination",
            "reason": cs_msg,
            "suggestion": "Please select a soil type suitable for the chosen crop.",
        })

    if crop_key not in CROP_MAP:
        raise HTTPException(400, f"Unsupported crop: {body.crop}")
    if soil_key not in SOIL_TYPE_MAP:
        raise HTTPException(400, f"Unsupported soil_type: {body.soil_type}")
    wl   = body.water_level.lower().strip()
    cond = body.soil_condition.lower().strip()

    ph, carbon = CONDITION_TO_PH_CARBON[cond]
    row = {
        "Temperature": body.temperature_c,
        "Moisture":    WATER_TO_MOISTURE[wl],
        "Rainfall":    WATER_TO_RAINFALL[wl],
        "PH":          ph,
        "Carbon":      carbon,
        "Soil":        SOIL_TYPE_MAP[soil_key],
        "Crop":        CROP_MAP[crop_key],
    }

    X_df       = pd.DataFrame([row])
    fertilizer = str(pipe.predict(X_df)[0])
    proba      = pipe.predict_proba(X_df)[0]
    confidence = float(proba.max())
    remarks    = (meta or {}).get("remark_by_class") or {}
    remark     = remarks.get(fertilizer)

    n_kg, p_kg, k_kg = [
        v * body.area_acres
        for v in ELEMENTAL_KG_PER_ACRE.get(fertilizer, (18.0, 12.0, 12.0))
    ]

    prices    = await get_fertilizer_prices()
    urea_p    = prices["urea"]
    dap_p     = prices["dap"]
    mop_p     = prices["mop"]
    N_PER_BAG = urea_p["kg_per_bag"] * urea_p["nutrient_pct"]
    P_PER_BAG = dap_p["kg_per_bag"]  * dap_p["nutrient_pct"]
    K_PER_BAG = mop_p["kg_per_bag"]  * mop_p["nutrient_pct"]

    agro_ub = n_kg / N_PER_BAG if N_PER_BAG > 0 else 0
    agro_db = p_kg / P_PER_BAG if P_PER_BAG > 0 else 0
    agro_mb = k_kg / K_PER_BAG if K_PER_BAG > 0 else 0
    agro_uc, agro_dc, agro_mc = (agro_ub * urea_p["price_per_bag"],
                                  agro_db * dap_p["price_per_bag"],
                                  agro_mb * mop_p["price_per_bag"])
    agro_total = agro_uc + agro_dc + agro_mc

    price_source     = urea_p.get("source", "fert.nic.in")
    price_fetched_at = str(urea_p.get("fetched_at", datetime.now(timezone.utc).isoformat()))[:19]

    budget_fields: dict = {}
    if body.budget_inr and body.budget_inr > 0:
        budget_fields = compute_budget_plan(n_kg, p_kg, k_kg, body.budget_inr, prices)

    note = (
        "Fertilizer type predicted by Random Forest trained on Kaggle agronomic dataset. "
        "N–P–K rates are typical for the predicted product class. "
        f"Prices sourced from {price_source}. Validate with your local extension office."
    )

    response = PredictResponse(
        fertilizer_recommended=fertilizer,
        confidence=round(confidence, 4),
        remark=remark,
        nitrogen_kg=round(n_kg, 2),
        phosphorus_kg=round(p_kg, 2),
        potassium_kg=round(k_kg, 2),
        price_urea_per_bag=urea_p["price_per_bag"],
        price_dap_per_bag=dap_p["price_per_bag"],
        price_mop_per_bag=mop_p["price_per_bag"],
        price_source=price_source,
        price_fetched_at=price_fetched_at,
        agro_urea_bags=round(agro_ub, 2),
        agro_dap_bags=round(agro_db, 2),
        agro_mop_bags=round(agro_mb, 2),
        agro_urea_cost=round(agro_uc, 2),
        agro_dap_cost=round(agro_dc, 2),
        agro_mop_cost=round(agro_mc, 2),
        agro_total_cost=round(agro_total, 2),
        budget_inr=body.budget_inr if body.budget_inr and body.budget_inr > 0 else None,
        **budget_fields,
        model="RandomForestClassifier",
        holdout_accuracy=(meta or {}).get("holdout_accuracy"),
        dataset=str((meta or {}).get("dataset", "nishchalchandel/fertilizer-recommendation")),
        note=note,
        soil_compatibility_status=cs_status,
        soil_compatibility_message=cs_msg if cs_msg else None,
    )

    if current_user:
        db = get_db()
        await db.analysis_history.insert_one({
            "user_id":    current_user["user_id"],
            "email":      current_user["email"],
            "created_at": datetime.now(timezone.utc),
            "inputs": {
                "crop":             body.crop,
                "soil_type":        body.soil_type,
                "area_acres":       body.area_acres,
                "temperature_c":    body.temperature_c,
                "water_level":      body.water_level,
                "soil_condition":   body.soil_condition,
                "budget_inr":       body.budget_inr,
                "soil_moisture_pct": None,
                "soil_humidity_pct": None,
            },
            "results": {
                "fertilizer_recommended": fertilizer,
                "confidence":             round(confidence, 4),
                "nitrogen_kg":            round(n_kg, 2),
                "phosphorus_kg":          round(p_kg, 2),
                "potassium_kg":           round(k_kg, 2),
                "agro_total_cost":        round(agro_total, 2),
                "budget_total_cost":      budget_fields.get("budget_total_cost"),
                "budget_coverage_pct":    budget_fields.get("budget_coverage_pct"),
                "price_source":           price_source,
            },
        })

    return response


# ─────────────────────────────────────────────────────────────────────────────
# HISTORY ROUTES
# ─────────────────────────────────────────────────────────────────────────────
@api.get("/history")
async def get_history(current_user=Depends(get_current_user)):
    db   = get_db()
    docs = await db.analysis_history.find(
        {"user_id": current_user["user_id"]},
        sort=[("created_at", -1)],
        limit=50,
    ).to_list(50)
    result = []
    for d in docs:
        d["_id"] = str(d["_id"])
        if "created_at" in d and hasattr(d["created_at"], "isoformat"):
            d["created_at"] = d["created_at"].isoformat()
        result.append(d)
    return result


@api.delete("/history/{doc_id}")
async def delete_history_item(doc_id: str,
                               current_user=Depends(get_current_user)):
    db  = get_db()
    res = await db.analysis_history.delete_one(
        {"_id": ObjectId(doc_id), "user_id": current_user["user_id"]}
    )
    if res.deleted_count == 0:
        raise HTTPException(404, "Record not found")
    return {"deleted": True}


# ─────────────────────────────────────────────────────────────────────────────
# MISC ROUTES
# ─────────────────────────────────────────────────────────────────────────────
@api.get("/health")
async def health():
    return {"ok": CLF_PATH.is_file(), "model": str(CLF_PATH)}

@api.get("/predict-npk")
def predict_hint():
    return {"detail": "Use POST with JSON body."}

@api.get("/metrics")
def metrics():
    p = ROOT / "models" / "metrics.json"
    if not p.is_file():
        raise HTTPException(503, "Run train.py to generate metrics.json")
    return json.loads(p.read_text(encoding="utf-8"))


app.include_router(api)

@app.get("/health", include_in_schema=False)
def legacy_health():
    return RedirectResponse("/api/health", 307)

@app.post("/predict-npk", include_in_schema=False)
async def legacy_predict(body: PredictRequest, cu=Depends(optional_user)):
    return await predict_npk(body, cu)

# ─────────────────────────────────────────────────────────────────────────────
# STATIC FILES — serve frontend from parent directory
# ─────────────────────────────────────────────────────────────────────────────
_FRONTEND_DIR = Path(os.environ.get("FERTILIZER_FRONTEND_DIR", str(ROOT.parent))).resolve()
_INDEX_HTML   = _FRONTEND_DIR / "index.html"

@app.get("/", include_in_schema=False)
def serve_index():
    if not _INDEX_HTML.is_file():
        raise HTTPException(404, "index.html not found")
    return FileResponse(_INDEX_HTML, media_type="text/html")

if _FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIR), html=False), name="frontend")

# ─────────────────────────────────────────────────────────────────────────────
# ENTRYPOINT
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
