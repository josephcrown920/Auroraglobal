#!/usr/bin/env python3
"""
Aurora Studio — Vast.ai GPU worker launcher.

Runs on any Vast.ai instance (RTX 3090/4090, A100, H100, …) and:
  1. Installs LatentSync + MimicMotion weights (based on AURORA_TASKS).
  2. Starts the Aurora FastAPI worker on port 8000.
  3. Detects the instance's public URL from Vast.ai env vars and
     auto-registers with Aurora — no Admin dashboard edits needed.

Set these as environment variables in your Vast.ai instance template:

  Required:
    AURORA_URL              your Aurora app URL, e.g. https://your-app.replit.app
    AURORA_REGISTER_SECRET  same value set as AURORA_REGISTER_SECRET in Aurora's env

  Optional:
    AURORA_TASKS            lipsync,motion,assemble (default); motion needs ≥24 GB VRAM
    AURORA_WORKER_TOKEN     random bearer for /generate (openssl rand -hex 16)
    AURORA_UPLOAD           catbox (default, no account) | 0x0 | supabase
    AURORA_WORKER_NAME      display name in Admin → Workers
    IMAGE_MODEL             black-forest-labs/FLUX.1-schnell (on A100+; default=sdxl-turbo)

  Auto-set by Vast.ai (do NOT override):
    VAST_TCP_HOST           external proxy hostname
    VAST_TCP_PORT_8000      external port mapped to container port 8000

Usage (paste as Vast.ai "On-Start Script", or SSH in and run):
  python3 aurora_worker_vast.py
"""
from __future__ import annotations

import hashlib
import os
import subprocess
import sys
import time
import urllib.request

ROOT = "/workspace"
WORKER_PORT = 8000

# ── Config from env ────────────────────────────────────────────────────────────

AURORA_URL = os.environ.get("AURORA_URL", "").strip().rstrip("/")
REGISTER_SECRET = os.environ.get("AURORA_REGISTER_SECRET", "").strip()
WORKER_TOKEN = os.environ.get("AURORA_WORKER_TOKEN", "").strip()
AURORA_TASKS = os.environ.get("AURORA_TASKS", "lipsync,motion,assemble").strip()
WORKER_NAME = os.environ.get("AURORA_WORKER_NAME", "vast-worker").strip()

# Validate early — fail loudly before the multi-minute weight download.
if not AURORA_URL:
    raise SystemExit(
        "AURORA_URL is not set.\n"
        "Add it in your Vast.ai instance template environment variables,\n"
        "e.g. AURORA_URL=https://your-app.replit.app"
    )
if not REGISTER_SECRET:
    raise SystemExit(
        "AURORA_REGISTER_SECRET is not set.\n"
        "Generate one with: openssl rand -hex 32\n"
        "Set it BOTH here and as AURORA_REGISTER_SECRET in Aurora's Replit Secrets."
    )


def sh(cmd: str, **kwargs) -> None:
    print(f"$ {cmd}", flush=True)
    subprocess.run(cmd, shell=True, check=True, **kwargs)


# ── Step 1: install deps + fetch shared worker files ──────────────────────────

def setup() -> None:
    os.makedirs(ROOT, exist_ok=True)

    print("\n==> Installing Python deps …", flush=True)
    sh("pip install -q requests fastapi 'uvicorn[standard]' huggingface_hub[cli]")

    print("\n==> Fetching aurora_worker.py and setup.sh from Aurora …", flush=True)
    for name, dest in [
        ("aurora_worker.py", f"{ROOT}/aurora_worker.py"),
        ("setup.sh",         f"{ROOT}/setup.sh"),
    ]:
        url = f"{AURORA_URL}/api/public/workers/files/{name}"
        print(f"  GET {url}", flush=True)
        urllib.request.urlretrieve(url, dest)

    tasks = ",".join(t.strip() for t in AURORA_TASKS.split(",") if t.strip())
    os.environ["AURORA_TASKS"] = tasks
    os.environ["AURORA_CAPABILITIES"] = tasks

    print(f"\n==> Running setup.sh for tasks: [{tasks}] …", flush=True)
    sh(f"AURORA_TASKS='{tasks}' bash {ROOT}/setup.sh {ROOT}")

    os.environ["LATENTSYNC_DIR"] = f"{ROOT}/LatentSync"
    os.environ["MIMICMOTION_DIR"] = f"{ROOT}/MimicMotion"
    os.environ.setdefault("AURORA_UPLOAD", "catbox")
    os.environ.setdefault("AURORA_WORKER_NAME", WORKER_NAME)
    if WORKER_TOKEN:
        os.environ["AURORA_WORKER_TOKEN"] = WORKER_TOKEN


# ── Step 2: detect public URL ──────────────────────────────────────────────────

def detect_public_url() -> str:
    """
    Vast.ai automatically injects VAST_TCP_HOST and VAST_TCP_PORT_<N> env vars.
    The external URL for container port 8000 is http://$VAST_TCP_HOST:$VAST_TCP_PORT_8000.

    Falls back to ngrok (NGROK_AUTHTOKEN + optional NGROK_STATIC_DOMAIN) if those
    aren't set — useful when running on a plain VM or behind a NAT.
    """
    vast_host = os.environ.get("VAST_TCP_HOST", "").strip()
    vast_port = os.environ.get(f"VAST_TCP_PORT_{WORKER_PORT}", "").strip()

    if vast_host and vast_port:
        url = f"http://{vast_host}:{vast_port}"
        print(f"[vast] detected Vast.ai public URL: {url}", flush=True)
        return url

    # Fallback: ngrok tunnel
    ngrok_token = os.environ.get("NGROK_AUTHTOKEN", "").strip()
    if ngrok_token:
        print("[vast] VAST_TCP_HOST not set — falling back to ngrok tunnel …", flush=True)
        sh("pip install -q pyngrok")
        from pyngrok import ngrok  # type: ignore
        ngrok.set_auth_token(ngrok_token)
        domain = os.environ.get("NGROK_STATIC_DOMAIN", "").strip()
        if domain:
            host = domain.replace("https://", "").replace("http://", "").rstrip("/")
            ngrok.connect(addr=str(WORKER_PORT), domain=host)
            return f"https://{host}"
        tunnel = ngrok.connect(WORKER_PORT)
        url: str = tunnel.public_url  # type: ignore[assignment]
        print(f"[vast] ngrok URL (changes on restart — set NGROK_STATIC_DOMAIN to fix): {url}", flush=True)
        return url

    raise SystemExit(
        "Cannot determine public URL.\n"
        "On Vast.ai: make sure port 8000 is open in your instance template\n"
        "(Vast.ai will then set VAST_TCP_HOST + VAST_TCP_PORT_8000 automatically).\n"
        "Alternatively: set NGROK_AUTHTOKEN (+ NGROK_STATIC_DOMAIN for a stable URL)."
    )


# ── Step 3: start the worker ───────────────────────────────────────────────────

def start_worker() -> "subprocess.Popen[bytes]":
    print(f"\n==> Starting Aurora worker on port {WORKER_PORT} …", flush=True)
    proc = subprocess.Popen(
        [
            sys.executable, "-m", "uvicorn", "aurora_worker:app",
            "--host", "0.0.0.0", "--port", str(WORKER_PORT),
        ],
        cwd=ROOT,
    )
    # Wait until /health responds (max 2 min).
    for _ in range(60):
        if proc.poll() is not None:
            raise SystemExit(f"uvicorn exited early (code {proc.returncode}). Check logs above.")
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{WORKER_PORT}/health", timeout=2)
            print("[vast] worker is healthy.", flush=True)
            return proc
        except Exception:
            time.sleep(2)
    proc.terminate()
    raise SystemExit("Worker never became healthy on port 8000 after 120 s.")


# ── Step 4: register with Aurora ──────────────────────────────────────────────

def register(public_url: str) -> None:
    import json
    import urllib.error

    host = public_url.rstrip("/")
    endpoint_url = f"{host}/generate"
    capabilities = [t.strip() for t in AURORA_TASKS.split(",") if t.strip()]

    key_fp = hashlib.sha256(REGISTER_SECRET.encode()).hexdigest()[:8]
    print(
        f"[register] using AURORA_REGISTER_SECRET fingerprint {key_fp} "
        f"(compare against Admin → Workers on a 401)",
        flush=True,
    )

    payload: dict = {
        "name": WORKER_NAME,
        "endpoint_url": endpoint_url,
        "protocol": "vast",
        "capabilities": capabilities,
    }
    if WORKER_TOKEN:
        payload["auth_token"] = WORKER_TOKEN

    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{AURORA_URL}/api/public/workers/register",
        data=body,
        headers={
            "apikey": REGISTER_SECRET,
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print(f"[register] OK ({resp.status}) — {endpoint_url} registered with Aurora.", flush=True)
    except urllib.error.HTTPError as e:
        body_text = e.read().decode(errors="replace")[:300]
        print(f"[register] failed {e.code}: {body_text}", flush=True)
        if e.code == 401:
            print(
                "[register] 401 hint: the AURORA_REGISTER_SECRET here and in Aurora's env "
                "must be byte-for-byte identical. Compare fingerprints in Admin → Workers → "
                "Recent registration attempts (received fp vs expected fp).",
                flush=True,
            )
    except Exception as exc:
        print(f"[register] error (worker still serving): {exc}", flush=True)


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 60, flush=True)
    print("  Aurora Vast.ai worker launcher", flush=True)
    print(f"  AURORA_URL  : {AURORA_URL}", flush=True)
    print(f"  AURORA_TASKS: {AURORA_TASKS}", flush=True)
    print("=" * 60, flush=True)

    setup()
    public_url = detect_public_url()
    worker_proc = start_worker()

    print(f"\n[vast] registering {public_url}/generate with Aurora …", flush=True)
    register(public_url)

    caps = AURORA_TASKS
    print("", flush=True)
    print(f"Worker live | protocol=vast | caps=[{caps}]", flush=True)
    print(f"Endpoint   : {public_url}/generate", flush=True)
    print("Waiting for jobs …  (keep this process running)", flush=True)
    print("", flush=True)

    worker_proc.wait()


if __name__ == "__main__":
    main()
