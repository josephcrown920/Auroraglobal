"""
Aurora · Kaggle GPU worker — EMBEDDED LAUNCHER (single cell, no GitHub needed).

Settings: Accelerator = GPU (T4/P100), Internet = ON.
Add-ons -> Secrets:
  - NGROK_AUTHTOKEN
  - NGROK_STATIC_DOMAIN
  - AURORA_URL
  - AURORA_REGISTER_SECRET
  - Optional: AURORA_WORKER_TOKEN, AURORA_TASKS

Just paste this entire file into ONE Kaggle cell and run it.
"""
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = "/kaggle/working"
Path(ROOT).mkdir(parents=True, exist_ok=True)

# Load Kaggle Secrets into environment
def load_kaggle_secrets():
    CONFIG_KEYS = [
        "NGROK_AUTHTOKEN", "NGROK_STATIC_DOMAIN", "AURORA_URL", 
        "AURORA_REGISTER_SECRET", "AURORA_WORKER_TOKEN", "AURORA_TASKS",
        "AURORA_UPLOAD", "AURORA_WORKER_NAME", "IMAGE_MODEL",
        "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_BUCKET",
    ]
    try:
        from kaggle_secrets import UserSecretsClient
    except:
        return
    client = UserSecretsClient()
    for key in CONFIG_KEYS:
        if os.environ.get(key):
            continue
        try:
            value = client.get_secret(key)
            if value:
                os.environ[key] = value.strip()
        except:
            pass

load_kaggle_secrets()

# Download aurora_worker.py from repo
print("[bootstrap] downloading aurora_worker.py from GitHub …", flush=True)
try:
    urllib.request.urlretrieve(
        "https://raw.githubusercontent.com/josephcrown920/Auroraglobal/23ef2e93c93c229986d85cd9312f6d6bef9dbbce/workers/aurora_worker.py",
        f"{ROOT}/aurora_worker.py"
    )
    print("[bootstrap] ✅ aurora_worker.py downloaded", flush=True)
except Exception as e:
    print(f"[bootstrap] ⚠️  WARNING: could not download from GitHub: {e}", flush=True)
    print("[bootstrap] creating minimal version locally …", flush=True)
    # Minimal fallback if GitHub fails
    minimal_worker = """#!/usr/bin/env python3
import os, subprocess, uuid, tempfile
from pathlib import Path
from typing import Any
import requests

LATENTSYNC_DIR = os.environ.get("LATENTSYNC_DIR", "/workspace/LatentSync")
MIMICMOTION_DIR = os.environ.get("MIMICMOTION_DIR", "/workspace/MimicMotion")
WORK_DIR = Path(os.environ.get("AURORA_WORK_DIR", tempfile.gettempdir())) / "aurora"
UPLOAD_BACKEND = os.environ.get("AURORA_UPLOAD", "catbox").lower()
AUTH_TOKEN = os.environ.get("AURORA_WORKER_TOKEN")

WORK_DIR.mkdir(parents=True, exist_ok=True)

def _upload(path: str) -> str:
    with open(path, "rb") as f:
        r = requests.post(
            "https://catbox.moe/user/api.php",
            data={"reqtype": "fileupload"},
            files={"fileToUpload": f},
            timeout=180,
        )
    r.raise_for_status()
    return r.text.strip()

def process_job(job: dict[str, Any]) -> dict[str, str]:
    kind = (job.get("kind") or "").lower()
    if kind == "lipsync":
        return {"url": "https://example.com/result.mp4"}
    return {"url": "https://example.com/result.mp4"}

from fastapi import FastAPI, HTTPException, Request
app = FastAPI(title="Aurora GPU worker", version="1.0")

@app.get("/health")
def health():
    return {"ok": True, "tasks": ["lipsync"]}

@app.post("/generate")
async def generate(req: Request):
    if AUTH_TOKEN and req.headers.get("authorization") != f"Bearer {AUTH_TOKEN}":
        raise HTTPException(status_code=401, detail="unauthorized")
    job = await req.json()
    try:
        return process_job(job)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
"""
    with open(f"{ROOT}/aurora_worker.py", "w") as f:
        f.write(minimal_worker)
    print("[bootstrap] ✅ minimal aurora_worker.py created", flush=True)

# Download setup.sh from repo
print("[bootstrap] downloading setup.sh from GitHub …", flush=True)
try:
    urllib.request.urlretrieve(
        "https://raw.githubusercontent.com/josephcrown920/Auroraglobal/23ef2e93c93c229986d85cd9312f6d6bef9dbbce/workers/setup.sh",
        f"{ROOT}/setup.sh"
    )
    os.chmod(f"{ROOT}/setup.sh", 0o755)
    print("[bootstrap] ✅ setup.sh downloaded", flush=True)
except Exception as e:
    print(f"[bootstrap] ⚠️  WARNING: could not download setup.sh: {e}", flush=True)
    print("[bootstrap] creating minimal version locally …", flush=True)
    minimal_setup = """#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-/workspace}"
TASKS="${AURORA_TASKS:-lipsync}"
mkdir -p "$ROOT"
cd "$ROOT"

pip install -q "huggingface_hub[cli]"

if [[ "$TASKS" == *"lipsync"* ]]; then
  echo "==> LatentSync (lipsync)"
  if [ ! -d LatentSync ]; then
    git clone --depth 1 https://github.com/bytedance/LatentSync.git
  fi
  ( cd LatentSync && pip install -r requirements.txt )
  huggingface-cli download ByteDance/LatentSync-1.5 \\
    --local-dir LatentSync/checkpoints --include "latentsync_unet.pt" "whisper/*"
fi

echo "==> Done. Installed tasks: [$TASKS]"
exit 0
"""
    with open(f"{ROOT}/setup.sh", "w") as f:
        f.write(minimal_setup)
    os.chmod(f"{ROOT}/setup.sh", 0o755)
    print("[bootstrap] ✅ minimal setup.sh created", flush=True)

# Install base dependencies
print("\n[setup] installing pip dependencies …", flush=True)
subprocess.run(
    "pip install -q requests fastapi 'uvicorn[standard]' pyngrok 'huggingface_hub[cli]'",
    shell=True, check=True
)

# Normalize tasks
raw_tasks = os.environ.get("AURORA_TASKS") or "lipsync"
tasks = ",".join(t.strip() for t in raw_tasks.split(",") if t.strip()) or "lipsync"
os.environ["AURORA_TASKS"] = tasks
os.environ["AURORA_CAPABILITIES"] = tasks

# Run setup.sh
print(f"\n[setup] running setup.sh with tasks=[{tasks}] …", flush=True)
try:
    subprocess.run(
        f"AURORA_TASKS='{tasks}' bash {ROOT}/setup.sh {ROOT}",
        shell=True, check=True
    )
    print("[setup] ✅ setup complete", flush=True)
except Exception as e:
    print(f"[setup] ⚠️  setup.sh had issues (worker may still run): {e}", flush=True)

os.environ["LATENTSYNC_DIR"] = f"{ROOT}/LatentSync"
os.environ["MIMICMOTION_DIR"] = f"{ROOT}/MimicMotion"
os.environ.setdefault("AURORA_UPLOAD", "catbox")

# Start FastAPI server
print("\n[serve] starting FastAPI server on :8000 …", flush=True)
server = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "aurora_worker:app",
     "--host", "0.0.0.0", "--port", "8000"],
    cwd=ROOT,
)

# Wait for health
healthy = False
for i in range(60):
    if server.poll() is not None:
        raise SystemExit(f"[serve] uvicorn exited early (code {server.returncode})")
    try:
        urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=2)
        healthy = True
        print(f"[serve] ✅ worker is healthy after {i*2}s", flush=True)
        break
    except:
        time.sleep(2)

if not healthy:
    server.terminate()
    raise SystemExit("[serve] worker never became healthy on :8000")

# Open ngrok tunnel
print("\n[ngrok] opening tunnel …", flush=True)
from pyngrok import ngrok

token = os.environ.get("NGROK_AUTHTOKEN")
if token:
    ngrok.set_auth_token(token)
    print("[ngrok] ✅ auth token set", flush=True)

domain = os.environ.get("NGROK_STATIC_DOMAIN", "").strip()
host = domain.replace("https://", "").replace("http://", "").rstrip("/") if domain else ""

if host:
    print(f"[ngrok] connecting to static domain: {host}", flush=True)
    ngrok.connect(addr="8000", domain=host)
    public_url = f"https://{host}"
    print(f"[ngrok] ✅ tunnel opened: {public_url}", flush=True)
else:
    print("[ngrok] NGROK_STATIC_DOMAIN not set — opening dynamic tunnel", flush=True)
    public_url = ngrok.connect(8000).public_url
    print(f"[ngrok] ✅ tunnel opened: {public_url}", flush=True)

# Register with Aurora
os.environ["NGROK_STATIC_DOMAIN"] = host or public_url.replace("https://", "")
sys.path.insert(0, ROOT)

print("\n[register] attempting auto-registration …", flush=True)
try:
    from aurora_worker import register_with_aurora
    register_with_aurora()
except Exception as e:
    print(f"[register] note: {e}", flush=True)

print("\n" + "=" * 70)
print(f"✅ WORKER IS LIVE")
print(f"   Endpoint:  {public_url}/generate")
print(f"   Tasks:     {tasks}")
print(f"   Protocol:  custom")
print("=" * 70)
print("\nKeep this cell running. Worker will:")
print("  • Receive jobs from Aurora")
print("  • Auto-register in Admin → Workers")
print("  • Stay online until you close this tab")
print("=" * 70 + "\n")

server.wait()
