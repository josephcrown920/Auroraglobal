"""
Aurora worker — Kaggle notebook runner (custom protocol via a public tunnel).

Kaggle gives ~30 GPU hrs/week free. Paste this into a Kaggle notebook cell (GPU
accelerator ON, "Internet" ON). It:
  1. clones + installs LatentSync + MimicMotion and fetches weights,
  2. starts the shared FastAPI app (aurora_worker:app) on :8000,
  3. opens a public tunnel and prints the /generate URL to register in Aurora.

Register the printed URL as a `custom` worker with capabilities `lipsync,motion`.
Tunnels die when the notebook stops — re-run and update the endpoint to reconnect.
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

    # Public tunnel (set NGROK_AUTHTOKEN as a Kaggle secret for a stable session).
    from pyngrok import ngrok
    token = os.environ.get("NGROK_AUTHTOKEN")
    if token:
        ngrok.set_auth_token(token)
    public_url = ngrok.connect(8000).public_url
    print("\n" + "=" * 60)
    print("Register THIS in Aurora (Admin → Workers, protocol=custom):")
    print(f"  Endpoint:     {public_url}/generate")
    print("  Capabilities: lipsync,motion")
    print("=" * 60 + "\n", flush=True)
    server.wait()


if __name__ == "__main__":
    setup()
    serve_and_tunnel()
