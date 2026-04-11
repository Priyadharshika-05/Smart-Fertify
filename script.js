// Reference nutrient prices in USD/kg — used for Panel 1 (ideal cost display).
const NUTRIENT_USD_PER_KG = {
    nitrogen:   50,
    phosphorus: 60,
    potassium:  70
};
const INR_PER_USD_FALLBACK = 83;

// ── ML API base URL ───────────────────────────────────────
function defaultMlApiBase() {
    if (typeof window === 'undefined') return 'http://127.0.0.1:8000';
    if (window.ML_API_BASE) return window.ML_API_BASE;
    const { protocol, hostname, port } = window.location;
    if (!hostname) return 'http://127.0.0.1:8000';
    if (port === '8000') return '';
    return `${protocol}//${hostname}:8000`;
}
const ML_API_BASE = defaultMlApiBase();

function apiUrl(path) {
    const p      = path.startsWith('/') ? path : `/${path}`;
    const withApi = p.startsWith('/api/') ? p : `/api${p}`;
    const base   = ML_API_BASE.replace(/\/$/, '');
    return base ? `${base}${withApi}` : withApi;
}

function escapeHtml(s) {
    if (s == null || s === '') return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

// ── DOM Ready ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
    const fertilizerForm = document.getElementById('fertilizerForm');
    if (fertilizerForm) {
        fertilizerForm.addEventListener('submit', function (e) {
            e.preventDefault();
            void calculateFertilizer();
        });
    }

    updateSoilTypeOptions();

    const btnSoil = document.getElementById('btnSuggestSoilCondition');
    if (btnSoil) {
        btnSoil.addEventListener('click', () => void suggestSoilConditionFromSensors());
    }
});

// ── Formatting helpers ────────────────────────────────────
function fmtRupee(v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n).toLocaleString('en-IN') : '—';
}

function fmtKg(v) {
    const n = Number(v);
    return Number.isFinite(n) ? (Math.round(n * 100) / 100).toFixed(2) : '0.00';
}

// ── Cost calculator (ideal NPK cost using USD/kg prices) ──
function calcIdealCostInr(n_kg, p_kg, k_kg, inrPerUsd) {
    const u    = NUTRIENT_USD_PER_KG;
    const r    = inrPerUsd;
    const nCost = n_kg * u.nitrogen   * r;
    const pCost = p_kg * u.phosphorus * r;
    const kCost = k_kg * u.potassium  * r;
    return {
        nitrogen:   Math.round(nCost),
        phosphorus: Math.round(pCost),
        potassium:  Math.round(kCost),
        total:      Math.round(nCost + pCost + kCost)
    };
}

// ── NPK table builder (shared by both panels) ─────────────
function buildNpkTable(n, p, k, cost) {
    const total = n + p + k;
    return `
    <table class="result-table">
        <thead>
            <tr>
                <th>Nutrient</th>
                <th>Amount (kg)</th>
                <th>Cost (₹)</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><span class="nutrient-dot n-dot"></span> Nitrogen (N)</td>
                <td class="val-cell">${fmtKg(n)}</td>
                <td class="val-cell">₹${fmtRupee(cost.nitrogen)}</td>
            </tr>
            <tr>
                <td><span class="nutrient-dot p-dot"></span> Phosphorus (P)</td>
                <td class="val-cell">${fmtKg(p)}</td>
                <td class="val-cell">₹${fmtRupee(cost.phosphorus)}</td>
            </tr>
            <tr>
                <td><span class="nutrient-dot k-dot"></span> Potassium (K)</td>
                <td class="val-cell">${fmtKg(k)}</td>
                <td class="val-cell">₹${fmtRupee(cost.potassium)}</td>
            </tr>
            <tr class="total-row">
                <td><strong>Total</strong></td>
                <td class="val-cell"><strong>${fmtKg(total)}</strong></td>
                <td class="val-cell"><strong>₹${fmtRupee(cost.total)}</strong></td>
            </tr>
        </tbody>
    </table>`;
}

// ── Main display — two panels side by side ────────────────
function displayResults(mlData, budgetInr, inrPerUsd) {
    const resultsDiv     = document.getElementById('recommendationResults');
    const resultsSection = document.getElementById('results');

    // ── Panel 1: Ideal NPK (straight from ML model) ───────
    const idealN = mlData.nitrogen_kg;
    const idealP = mlData.phosphorus_kg;
    const idealK = mlData.potassium_kg;

    // Use agro cost from backend if available, otherwise calculate from USD prices
    let idealCost;
    if (mlData.agro_total_cost != null) {
        // Use the real fert.nic.in prices from backend
        idealCost = {
            nitrogen:   Math.round(mlData.agro_urea_cost  || 0),
            phosphorus: Math.round(mlData.agro_dap_cost   || 0),
            potassium:  Math.round(mlData.agro_mop_cost   || 0),
            total:      Math.round(mlData.agro_total_cost || 0)
        };
    } else {
        idealCost = calcIdealCostInr(idealN, idealP, idealK, inrPerUsd);
    }

    // ── Panel 2: Budget-adjusted NPK ──────────────────────
    // Use backend budget plan if available (uses real fert prices)
    let adjN, adjP, adjK, adjCost, coveragePct, canAffordFull;

    if (mlData.budget_nitrogen_kg != null) {
        // Backend calculated this using real fert.nic.in prices
        adjN = mlData.budget_nitrogen_kg;
        adjP = mlData.budget_phosphorus_kg;
        adjK = mlData.budget_potassium_kg;
        adjCost = {
            nitrogen:   Math.round(mlData.budget_urea_cost || 0),
            phosphorus: Math.round(mlData.budget_dap_cost  || 0),
            potassium:  Math.round(mlData.budget_mop_cost  || 0),
            total:      Math.round(mlData.budget_total_cost || 0)
        };
        coveragePct   = Math.round(mlData.budget_coverage_pct || 0);
        canAffordFull = coveragePct >= 99;
    } else {
        // Fallback: scale by proportion using USD prices
        canAffordFull = idealCost.total <= budgetInr;
        if (canAffordFull) {
            adjN = idealN; adjP = idealP; adjK = idealK;
            adjCost = idealCost;
            coveragePct = 100;
        } else {
            const factor = budgetInr / idealCost.total;
            adjN = Math.round(idealN * factor * 100) / 100;
            adjP = Math.round(idealP * factor * 100) / 100;
            adjK = Math.round(idealK * factor * 100) / 100;
            adjCost = calcIdealCostInr(adjN, adjP, adjK, inrPerUsd);
            coveragePct = Math.round(factor * 100);
        }
    }

    // Coverage badge colour
    const coverageClass = coveragePct >= 80 ? 'badge-coverage-good'
                        : coveragePct >= 50 ? 'badge-coverage-warn'
                        :                     'badge-coverage-low';

    // Budget status message
    const budgetMsg = canAffordFull
        ? `<div class="budget-status budget-ok">
               ✓ Your budget of <strong>₹${fmtRupee(budgetInr)}</strong> fully covers the ideal requirement.
           </div>`
        : `<div class="budget-status budget-short">
               ⚠ Budget of <strong>₹${fmtRupee(budgetInr)}</strong> covers
               <strong>${coveragePct}%</strong> of the ideal amount.
               Consider increasing your budget for full crop benefit.
           </div>`;

    // Backend budget note (e.g. "Nitrogen prioritised first")
    const budgetNoteHtml = mlData.budget_note
        ? `<div class="budget-status budget-${mlData.budget_note_class || 'ok'} mt-2">${escapeHtml(mlData.budget_note)}</div>`
        : '';

    // Accuracy text
    const accText = mlData.holdout_accuracy != null
        ? `Hold-out accuracy: <strong>${(mlData.holdout_accuracy * 100).toFixed(1)}%</strong>`
        : '';

    // Price source note
    const priceNote = mlData.price_source
        ? `<span style="font-size:0.7rem;color:var(--text-muted);">Prices: ${escapeHtml(mlData.price_source)}</span>`
        : '';

    const html = `
        <!-- ML Banner -->
        <div class="ml-banner">
            <div class="ml-banner-left">
                <span class="ml-label">ML Recommendation</span>
                <span class="fertilizer-name">${escapeHtml(mlData.fertilizer_recommended)}</span>
                <span class="confidence-pill">${(mlData.confidence * 100).toFixed(1)}% confidence</span>
            </div>
            <div class="ml-banner-right">
                ${accText ? `<span class="acc-text">${accText}</span>` : ''}
                ${mlData.remark ? `<span class="remark-text">${escapeHtml(mlData.remark)}</span>` : ''}
            </div>
        </div>

        <!-- Budget status -->
        ${budgetMsg}
        ${budgetNoteHtml}

        <!-- Two result panels side by side -->
        <div class="result-panels">

            <!-- Panel 1: Ideal Requirement -->
            <div class="result-panel panel-ideal">
                <div class="panel-header">
                    <div class="panel-icon">🌱</div>
                    <div class="panel-header-text">
                        <div class="panel-title">Ideal Requirement</div>
                        <div class="panel-sub">What your crop &amp; soil truly needs</div>
                    </div>
                </div>
                ${buildNpkTable(idealN, idealP, idealK, idealCost)}
                <div class="panel-footer">
                    Full estimated cost: <strong>₹${fmtRupee(idealCost.total)}</strong>
                    &nbsp;${priceNote}
                </div>
            </div>

            <!-- Panel 2: Budget-Adjusted Plan -->
            <div class="result-panel panel-budget">
                <div class="panel-header">
                    <div class="panel-icon">💰</div>
                    <div class="panel-header-text">
                        <div class="panel-title">Budget-Adjusted Plan</div>
                        <div class="panel-sub">
                            Optimised for ₹${fmtRupee(budgetInr)}
                            &nbsp;<span class="badge-coverage ${coverageClass}">${coveragePct}% of ideal</span>
                        </div>
                    </div>
                </div>
                ${buildNpkTable(adjN, adjP, adjK, adjCost)}
                <div class="panel-footer">
                    ${canAffordFull
                        ? '✓ Full ideal amount is affordable within your budget.'
                        : `Scaled to fit ₹${fmtRupee(budgetInr)}. Increase budget for optimal results.`
                    }
                </div>
            </div>

        </div>

        <!-- Disclaimer -->

    `;

    resultsDiv.innerHTML = html;
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// ── Sensor suggestion ─────────────────────────────────────
function parseDashboardSensorPercent(elementId) {
    const el = document.getElementById(elementId);
    if (!el || !el.textContent) return null;
    const m = String(el.textContent).trim().match(/([\d.]+)/);
    return m ? parseFloat(m[0]) : null;
}

async function suggestSoilConditionFromSensors() {
    const hum = parseDashboardSensorPercent('humidityValue');
    const sm  = parseDashboardSensorPercent('soilMoistureValue');
    if (hum === null || sm === null) {
        alert('Could not read Humidity / Soil Moisture. Wait for sensor values to appear and try again.');
        return;
    }
    try {
        const res = await fetch(apiUrl('/predict-soil-condition'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ humidity_pct: hum, soil_moisture_pct: sm })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const sel = document.getElementById('soilCondition');
        if (sel) {
            sel.value = data.soil_condition;
            sel.classList.add('border-success');
            setTimeout(() => sel.classList.remove('border-success'), 1200);
        }
        alert(`ML soil condition: ${data.soil_condition} (${(data.confidence * 100).toFixed(1)}% confidence)\nfrom humidity ${hum}% and soil moisture ${sm}%.`);
    } catch (e) {
        console.error(e);
        alert('Soil-sensor ML failed. Run: python train_soil_condition.py\n\n' + (e instanceof Error ? e.message : String(e)));
    }
}

// ── Soil type dropdown ────────────────────────────────────
function updateSoilTypeOptions() {
    const cropSelect     = document.getElementById('cropType');
    const soilTypeSelect = document.getElementById('soilType');
    if (!cropSelect || !soilTypeSelect) return;
    const soilTypes = ['clay', 'sandy', 'loamy'];
    soilTypeSelect.innerHTML = '<option value="">Select Soil Type</option>';
    soilTypes.forEach(type => {
        const opt = document.createElement('option');
        opt.value = type;
        opt.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        soilTypeSelect.appendChild(opt);
    });
}

// ── ML API call ───────────────────────────────────────────
// Sends budget_inr + auth token so MongoDB history is saved correctly
async function fetchMlNpk(cropType, soilType, area, budget, temperature, waterLevel, soilCondition) {
    const headers = { 'Content-Type': 'application/json' };
    // Attach auth token if the user is logged in — backend needs this to save history
    const token = localStorage.getItem('sf_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(apiUrl('/predict-npk'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
            crop:           cropType,
            soil_type:      soilType,
            area_acres:     area,
            temperature_c:  temperature,
            water_level:    waterLevel,
            soil_condition: soilCondition,
            budget_inr:     budget        // ← required for backend budget plan + MongoDB save
        })
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
    }
    return res.json();
}

// ── Main calculate function ───────────────────────────────
async function calculateFertilizer() {
    const cropType      = document.getElementById('cropType').value;
    const soilType      = document.getElementById('soilType').value;
    const area          = parseFloat(document.getElementById('area').value);
    const budget        = parseFloat(document.getElementById('budget').value);
    const temperature   = parseFloat(document.getElementById('temperature').value);
    const waterLevel    = document.getElementById('waterLevel').value;
    const soilCondition = document.getElementById('soilCondition').value;

    if (!cropType || !soilType || !area || !budget || !temperature || !waterLevel || !soilCondition) {
        alert('Please fill in all fields');
        return;
    }

    const form      = document.getElementById('fertilizerForm');
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    const prevLabel = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Analysing…'; }

    // Clear any previous compat warning
    const warnDiv = document.getElementById('compatWarning');
    if (warnDiv) warnDiv.style.display = 'none';

    let mlData;
    try {
        mlData = await fetchMlNpk(cropType, soilType, area, budget, temperature, waterLevel, soilCondition);

        // Show soil compatibility warning if applicable
        if (mlData.soil_compatibility_status === 'warning' && mlData.soil_compatibility_message) {
            if (warnDiv) {
                warnDiv.textContent = '⚠ ' + mlData.soil_compatibility_message;
                warnDiv.style.display = 'block';
            }
        }

    } catch (err) {
        console.error(err);
        const errMsg = err instanceof Error ? err.message : String(err);

        // Try to parse structured FastAPI error (e.g. 422 crop-soil incompatibility)
        try {
            const parsed = JSON.parse(errMsg);
            const detail = parsed.detail;
            if (detail && typeof detail === 'object' && detail.reason) {
                alert(`❌ ${detail.error}\n\nReason: ${detail.reason}\n\nSuggestion: ${detail.suggestion}`);
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = prevLabel; }
                return;
            }
        } catch (_) { /* not JSON */ }

        alert(
            'ML API not reachable. Start the backend first:\n\n' +
            '  ./run_app.sh\n\n' +
            'Or: cd backend && python train.py && uvicorn app:app --host 127.0.0.1 --port 8000\n\n' +
            'Details: ' + errMsg
        );
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = prevLabel; }
        return;
    }

    // Fetch live USD→INR rate (used as fallback if backend prices unavailable)
    let inrPerUsd = INR_PER_USD_FALLBACK;
    try {
        const fr = await fetch(apiUrl('/fx/usd-inr'));
        if (fr.ok) {
            const j = await fr.json();
            if (typeof j.spot_inr_per_usd === 'number' && j.spot_inr_per_usd > 0) {
                inrPerUsd = j.spot_inr_per_usd;
            }
        }
    } catch (_) { /* use fallback */ }

    // Render both panels
    displayResults(mlData, budget, inrPerUsd);

    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = prevLabel; }
}
