# Installation Guide — Sustainable Fertilizer Usage Optimizer

Step-by-step instructions to install the **required software** and run this project on your computer.

---

## 1. What you need (summary)

| Requirement | Purpose |
|-------------|---------|
| **Python 3.10 or newer** (3.11 recommended) | Backend API, ML training, Uvicorn server |
| **pip** (usually bundled with Python) | Install Python packages |
| **Internet connection** | First-time download of Python packages and Kaggle dataset |
| **Modern web browser** | Chrome, Firefox, Safari, or Edge |
| **Terminal** | macOS/Linux: Terminal; Windows: PowerShell, Command Prompt, or Git Bash |

Optional but recommended: **Git** (if you clone the project from a repository).

You do **not** need Node.js, Java, or a separate database for the default setup.

---

## 2. Install Python

### macOS

1. Open **Terminal**.
2. Check if Python is already installed:
   ```bash
   python3 --version
   ```
3. If you see `Python 3.10.x` or higher, you can skip to **Section 3**.
4. If Python is missing or too old:
   - Install from [python.org/downloads](https://www.python.org/downloads/) (run the installer and enable **“Add python to PATH”** if shown), **or**
   - With Homebrew: `brew install python@3.11`

### Windows

1. Open **PowerShell** or **Command Prompt**.
2. Check:
   ```powershell
   py --version
   ```
   or
   ```powershell
   python --version
   ```
3. If needed, download the installer from [python.org/downloads](https://www.python.org/downloads/). During setup, check **“Add Python to PATH”**, then finish the install.
4. Close and reopen the terminal, then verify again.

### Linux (Ubuntu / Debian example)

```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv
python3 --version
```

---

## 3. Get the project on your machine

- If you have a **ZIP** of the project: unzip it and remember the folder path (it should contain `index.html`, `backend/`, and `run_app.sh`).
- If you use **Git**:
  ```bash
  git clone <your-repository-url>
  cd <project-folder>
  ```

**Important:** The folder must contain:

- `backend/` (with `app.py`, `train.py`, `requirements.txt`)
- `index.html` at the **same level** as `backend/` (not inside `backend/`)

---

## 4. Create a virtual environment (recommended)

A virtual environment keeps project libraries separate from other Python projects.

### macOS / Linux

```bash
cd /path/to/your/Fertilizer_project
python3 -m venv .venv
source .venv/bin/activate
```

You should see `(.venv)` at the start of your terminal prompt.

### Windows (PowerShell)

```powershell
cd C:\path\to\your\Fertilizer_project
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If execution policy blocks activation, run PowerShell **as Administrator** once:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Windows (Command Prompt)

```cmd
cd C:\path\to\your\Fertilizer_project
py -3 -m venv .venv
.venv\Scripts\activate.bat
```

---

## 5. Install Python dependencies

With the virtual environment **activated**:

```bash
pip install --upgrade pip
pip install -r backend/requirements.txt
```

This installs:

- **fastapi**, **uvicorn** — web server and API  
- **pandas**, **scikit-learn**, **joblib** — data and ML  
- **pydantic** — API validation  
- **kagglehub** — download the Kaggle CSV during training  

**First install may take a few minutes.** You need internet access.

---

## 6. Run the project

### Option A — One command (macOS / Linux)

From the **project root** (folder that contains `run_app.sh`):

```bash
chmod +x run_app.sh    # only needed once
./run_app.sh
```

The script will:

1. Train the **fertilizer** model (`python3 train.py`) **if** `backend/models/fertilizer_clf.pkl` is missing (downloads data via **kagglehub** — internet required).
2. Train the **soil-sensor** model (`python3 train_soil_condition.py`) **if** `backend/models/soil_condition_clf.pkl` is missing (synthetic data — no download).
3. Start the server on **http://127.0.0.1:8000**

Open your browser: **http://127.0.0.1:8000**

### Option B — Windows (no Bash)

In PowerShell or CMD, from the **project root**, with **venv activated**:

```powershell
cd backend
if (-not (Test-Path models\fertilizer_clf.pkl)) { py train.py }
$env:FERTILIZER_FRONTEND_DIR = (Resolve-Path ..).Path
py -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Or using `python` instead of `py` if that is what works on your PC.

### Option C — Manual steps (any OS)

```bash
export FERTILIZER_FRONTEND_DIR="/full/path/to/project-root"   # Linux/macOS
# Windows PowerShell: $env:FERTILIZER_FRONTEND_DIR = "C:\full\path\to\project-root"

cd backend
python3 train.py          # only if models/fertilizer_clf.pkl does not exist
python3 -m uvicorn app:app --host 127.0.0.1 --port 8000
```

---

## 7. Kaggle / dataset (first training)

- Training uses the public dataset **nishchalchandel/fertilizer-recommendation** via **kagglehub**.
- For this dataset you typically **do not** need a Kaggle account or API key.
- If download fails, check your **firewall / proxy** and try again when the network is stable.

---

## 8. Verify installation

1. Browser: **http://127.0.0.1:8000** — home page loads.
2. **http://127.0.0.1:8000/api/health** — JSON with `"ok": true` if the model file exists.
3. Use the **Fertilizer Calculator** and click **Calculate** — you should get an ML recommendation (not an alert saying the API is down).

---

## 9. Stop the server

In the terminal where Uvicorn is running, press **Ctrl+C**.

If port 8000 is stuck occupied:

- **macOS/Linux:** `lsof -ti :8000 | xargs kill -9`
- **Windows:** find the process using port 8000 in Task Manager or `netstat -ano` and end it.

---

## 10. Troubleshooting

| Problem | What to try |
|--------|-------------|
| `python3: command not found` | Use `py` or `python` on Windows; install Python and reopen the terminal. |
| `pip: command not found` | `python3 -m pip install -r backend/requirements.txt` |
| `Permission denied` on `run_app.sh` | Run `chmod +x run_app.sh` |
| `Address already in use` (port 8000) | Stop the other process or use another port: `uvicorn app:app --port 8001` (then open `:8001`; you may need to adjust bookmarks only). |
| Home page **404** | Set `FERTILIZER_FRONTEND_DIR` to the folder that **contains** `index.html`, then restart Uvicorn from `backend/`. |
| Calculator says API unreachable | Ensure Uvicorn is running and you open **http://127.0.0.1:8000** (same port as the server). |
| `train.py` fails on download | Check internet; retry; optionally download the CSV from Kaggle manually and run `python3 train.py --csv /path/to/fertilizer_recommendation_dataset.csv`. |

---

## 11. Reinstall / clean environment

```bash
deactivate                # if venv is active
rm -rf .venv              # macOS/Linux — deletes the venv
# Windows: rmdir /s /q .venv

python3 -m venv .venv
source .venv/bin/activate   # or Windows activate script
pip install -r backend/requirements.txt
```

---

## 12. Related documents

- **`PROJECT_DOCUMENTATION.md`** — Tools, algorithms, and ML design.
- **`backend/README.md`** — Backend-focused notes.

---

*If your course requires a specific Python version, match that version when installing.*
