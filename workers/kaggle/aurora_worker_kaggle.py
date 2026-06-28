"""
Aurora worker — Kaggle notebook runner (custom protocol via a public tunnel).

Kaggle gives ~30 GPU hrs/week free. Paste this into a Kaggle notebook cell (GPU
accelerator ON, "Internet" ON). It:
  1. clones + installs LatentSync + MimicMotion and fetches weights,
  2. starts the shared FastAPI app (aurora_worker:app) on :8000,
  3. opens a STABLE Ngrok tunnel (free static domain) and auto-registers itself.

Set these Kaggle secrets (Add-ons → Secrets) for zero-touch restarts:
  NGROK_AUTHTOKEN      your Ngrok account token
  NGROK_STATIC_DOMAIN  free static domain, e.g. "foo-bar.ngrok-free.app"
                       (claim one at https://dashboard.ngrok.com/domains)
  AURORA_URL           base URL of the Aurora app, e.g. "https://aurora.example.com"
  AURORA_REGISTER_KEY  Supabase anon/publishable key (the register `apikey`)
  AURORA_WORKER_TOKEN  (optional) bearer that protects this worker's /generate

With the static domain + register key set, the worker upserts its own row in
Admin → Workers on every boot — no manual dashboard edit is ever needed again.
"""
import os
import subprocess
import sys
import time
import urllib.request

ROOT = "/kaggle/working"


def sh(cmd: str):
    print(f"$ {cmd}", flush=True)
    subprocess.run(cmd, shell=True, check=True)


def setup():
    # Pull the Aurora contract layer + shared core from your repo (or upload them as a
    # Kaggle dataset and copy them in). Then run the model setup script.
    sh("pip install -q requests fastapi 'uvicorn[standard]' pyngrok")
    if not os.path.exists(f"{ROOT}/aurora_worker.py"):
        print("!! Upload workers/aurora_worker.py + workers/setup.sh to this notebook "
              "(Add Data → your files) and copy them to /kaggle/working first.")
    sh(f"bash {ROOT}/setup.sh {ROOT}")
    os.environ["LATENTSYNC_DIR"] = f"{ROOT}/LatentSync"
    os.environ["MIMICMOTION_DIR"] = f"{ROOT}/MimicMotion"
    os.environ.setdefault("AURORA_UPLOAD", "catbox")


def serve_and_tunnel():
    # Start the FastAPI app in the background.
    server = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "aurora_worker:app",
         "--host", "0.0.0.0", "--port", "8000"],
        cwd=ROOT,
    )
    # Wait for health.
    for _ in range(60):
        try:
            urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=2)
            break
        except Exception:
            time.sleep(2)

    # Stable public tunnel. With NGROK_STATIC_DOMAIN set, the URL is identical on
    # every restart, so the registered worker endpoint never goes stale.
    from pyngrok import ngrok
    token = os.environ.get("NGROK_AUTHTOKEN")
    if token:
        ngrok.set_auth_token(token)
    domain = os.environ.get("NGROK_STATIC_DOMAIN", "").strip()
    host = domain.replace("https://", "").replace("http://", "").rstrip("/")
    if host:
        # Pin the free static domain; let any error surface (no silent fallback).
        ngrok.connect(addr="8000", domain=host)
        public_url = f"https://{host}"
    else:
        public_url = ngrok.connect(8000).public_url
        print("[ngrok] NGROK_STATIC_DOMAIN not set — this URL changes each restart.",
              flush=True)

    # Auto-register in Aurora so no Admin → Workers edit is needed (reuses the
    # shared worker's register helper; reads AURORA_URL + AURORA_REGISTER_KEY).
    os.environ["NGROK_STATIC_DOMAIN"] = host or public_url.replace("https://", "")
    sys.path.insert(0, ROOT)
    try:
        from aurora_worker import register_with_aurora
        register_with_aurora()
    except Exception as e:
        print(f"[register] could not import register helper: {e}", flush=True)

    print("\n" + "=" * 60)
    print("Worker live (protocol=custom, caps=lipsync,motion):")
    print(f"  Endpoint:     {public_url}/generate")
    print("  Auto-registered in Aurora — no dashboard edit needed if the four")
    print("  AURORA_*/NGROK_* secrets are set. Otherwise add the URL manually.")
    print("=" * 60 + "\n", flush=True)
    server.wait()


if __name__ == "__main__":
    setup()
    serve_and_tunnel()
