# SmartFertify — Free Deployment Guide
## Stack: Render (backend + frontend as one service) + MongoDB Atlas

Your entire app — backend AND frontend — deploys as a **single Render web service**.
FastAPI serves the HTML/CSS/JS files directly. No Vercel needed. 100% free.

---

## Step 1 — Push to GitHub

```bash
# In your project root (your-project/)
git init
git add .
git commit -m "deploy: smartfertify v3"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/smartfertify.git
git push -u origin main
```

> ⚠️ Make sure your `.pkl` model files are committed.
> Check with: `git ls-files backend/models/`
> You should see: `fertilizer_clf.pkl`, `fertilizer_meta.pkl`, `soil_condition_clf.pkl`
> If missing, run `git add -f backend/models/*.pkl` and commit again.

---

## Step 2 — MongoDB Atlas Network Access

1. Go to https://cloud.mongodb.com
2. Click **Network Access** (left sidebar)
3. Click **Add IP Address**
4. Click **Allow Access from Anywhere** → confirms `0.0.0.0/0`
5. Click **Confirm**

---

## Step 3 — Deploy on Render

1. Go to https://render.com → **Sign up free** (use GitHub login)
2. Click **New → Web Service**
3. Click **Connect a repository** → select your `smartfertify` repo
4. Fill in the settings:

   | Field | Value |
   |---|---|
   | Name | `smartfertify` |
   | Region | Singapore (closest to India) |
   | Root Directory | `backend` |
   | Runtime | `Python 3` |
   | Build Command | `pip install -r requirements.txt` |
   | Start Command | `uvicorn app:app --host 0.0.0.0 --port $PORT` |
   | Instance Type | `Free` |

5. Scroll to **Environment Variables** → click **Add Environment Variable**:

   | Key | Value |
   |---|---|
   | `MONGO_URI` | `mongodb+srv://iotproject4444:iotproject4444password@cluster0.b0hkzok.mongodb.net/agrios?retryWrites=true&w=majority` |
   | `JWT_SECRET` | any random string like `my-super-secret-2024-xyz` |
   | `FERTILIZER_FRONTEND_DIR` | `..` |

6. Click **Create Web Service**

Render will build and deploy. Takes 2–4 minutes.
Your live URL will be: `https://smartfertify.onrender.com`

---

## Step 4 — Test It

Open your Render URL in a browser. You should see your SmartFertify homepage.

Test the API health:
```
https://smartfertify.onrender.com/api/health
```
Should return: `{"ok": true, "model": "..."}`

---

## Free Tier Limitations

| Issue | What it means |
|---|---|
| **Cold start** | If no one visits for 15 min, the server sleeps. First visit takes ~30 sec to wake up. Subsequent visits are instant. |
| **750 hours/month** | More than enough for a project (30 days × 24 hrs = 720 hrs). |
| **Ephemeral disk** | Files written at runtime are lost on restart — not a problem since your `.pkl` files are in the repo. |

### Tip to avoid cold starts (optional)
Use https://uptimerobot.com (free) to ping your `/api/health` URL every 14 minutes.
This keeps the server awake 24/7 for free.

---

## Local Development (unchanged)

```bash
# From project root
cd backend
MONGO_URI="mongodb+srv://..." uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

Then open http://127.0.0.1:8000 in your browser.
