"""
Aurora worker — Colab notebook runner (custom protocol via a stable tunnel).

Mirrors workers/kaggle/aurora_worker_kaggle.py exactly, adapted for Colab's
secrets API and filesystem. Colab's free tier gives a T4 (16 GB) or sometimes a
better card at random; Colab Pro/Pro+ can reserve an A100 (40 GB). Run this in
ONE Colab cell with **GPU ON**, or import the companion
`aurora_worker_colab.ipynb`. It:

  1. bridges your Colab **Secrets** (the key icon in the left sidebar) into the
     environment (Colab does not expose secrets as env vars on its own — they
     must be read via google.colab.userdata),
  2. fetches the shared worker core (`aurora_worker.py`) + `setup.sh` from your
     repo automatically — no manual file upload,
  3. installs only the task(s) that fit your Colab tier's GPU (lipsync by
     default, since that fits any free T4/P100),
  4. starts the FastAPI worker on :8000,
  5. opens a STABLE ngrok tunnel (free static domain) and auto-registers itself,
     so it appears as **Active** in Admin -> Workers with no dashboard edit ever.

Set these in Colab's Secrets panel (the key icon, left sidebar) — this cell
loads them for you via google.colab.userdata:
  NGROK_AUTHTOKEN      your ngrok account token (dashboard.ngrok.com)
  NGROK_STATIC_DOMAIN  free static domain, e.g. "foo-bar.ngrok-free.app"
                       (claim one at dashboard.ngrok.com/domains)
  AURORA_URL           your Aurora app base URL, e.g. "https://your-app.replit.app"
  AURORA_REGISTER_SECRET  private operator secret (the register `apikey`); set the
                       same value as AURORA_REGISTER_SECRET in Aurora's env — this
                       is NOT the Supabase anon/publishable key.
  AURORA_WORKER_TOKEN  (optional) bearer that protects this worker's /generate
  AURORA_TASKS         (optional) comma list of tasks to install and serve:
                         "lipsync"           — default, lipsync only (~10 GB disk,
                                               fits ANY Colab GPU incl. free T4)
                         "image,lipsync"     — adds SDXL-Turbo image gen (~17 GB disk)
                         "lipsync,motion"    — lipsync + MimicMotion (~24 GB GPU
                                               needed — Colab Pro+ A100 only, NOT
                                               the free tier)
                       motion (MimicMotion) needs a ~24 GB GPU; on a <20 GB Colab
                       card setup.sh refuses to install it instead of OOMing.
                       image (SDXL-Turbo) needs ~8 GB extra disk and fits T4/P100.
  IMAGE_MODEL          (optional) override the image model, e.g.
                         "black-forest-labs/FLUX.1-schnell" for an A100/H100 tier
  (worker files are fetched directly from your Aurora app at AURORA_URL —
   no GitHub access or public repo needed)

Alternative: this same free GPU can instead join the stock-ComfyUI swarm (image /
video / lipsync / motion via the `comfyui` protocol) — see workers/comfyui/ for
that launcher. Use THIS file for the leaner custom-protocol worker (lipsync-first,
no ComfyUI install); use the comfyui/ launcher if you'd rather run ComfyUI itself
and let Aurora ship the prompt graphs.
"""
import os
import subprocess
import sys
import time
import urllib.request

ROOT = "/content"

# Config this worker understands. Colab Secrets are NOT environment variables by
# default, so we pull each one via google.colab.userdata and mirror it into
# os.environ (which is what aurora_worker.py and setup.sh read).
CONFIG_KEYS = [
    "NGROK_AUTHTOKEN",
    "NGROK_STATIC_DOMAIN",
    "AURORA_URL",
    "AURORA_REGISTER_SECRET",
    "AURORA_REGISTER_KEY",  # retired name; loaded only so we can explain the migration
    "AURORA_WORKER_TOKEN",
    "AURORA_TASKS",
    "AURORA_UPLOAD",
    "AURORA_WORKER_NAME",
    # Image generation model override (default: stabilityai/sdxl-turbo on T4).
    "IMAGE_MODEL",
    # Optional: store results in your own Supabase bucket (AURORA_UPLOAD=supabase).
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_BUCKET",
]

def load_colab_secrets():
    """Mirror Colab Secrets into os.environ (no-op off Colab / when unset)."""
    try:
        from google.colab import userdata
    except Exception:
        return  # not on Colab, or the helper is unavailable — rely on os.environ
    for key in CONFIG_KEYS:
        if os.environ.get(key):
            continue  # an explicit env var always wins over a secret
        try:
            value = userdata.get(key)
        except Exception:
            value = None  # secret simply not set, or notebook access not granted — fine
        if value:
            os.environ[key] = value.strip()


def sh(cmd: str):
    print(f"$ {cmd}", flush=True)
    subprocess.run(cmd, shell=True, check=True)


# Secrets required for auto-registration. Checked up front (before the
# multi-minute pip install / weight download in setup()) so a missing or
# misspelled Colab secret is loud on line 1 of the log, not silently
# discovered 10+ minutes later inside register_with_aurora() when the owner
# is staring at Admin -> Workers wondering why nothing showed up.
_REQUIRED_FOR_REGISTER = [
    ("NGROK_AUTHTOKEN", "ngrok dashboard -> Your Authtoken (dashboard.ngrok.com/get-started/your-authtoken)"),
    ("NGROK_STATIC_DOMAIN", "ngrok dashboard -> Domains -> claim a free static domain (dashboard.ngrok.com/domains)"),
    ("AURORA_URL", "your Aurora app base URL, e.g. https://your-app.replit.app"),
    ("AURORA_REGISTER_SECRET", "private operator secret -- set the SAME value as AURORA_REGISTER_SECRET in Aurora's env; NEVER the Supabase anon/publishable or service-role key"),
]


def warn_if_register_secrets_missing():
    """Print a loud, actionable warning before setup() if auto-register can't work.

    Does not raise: the worker is still useful without registration (an owner
    can add the URL by hand in Admin -> Workers), but they should know that
    *before* waiting through the install instead of after.
    """
    legacy_key = os.environ.get("AURORA_REGISTER_KEY", "").strip()
    if legacy_key:
        print("\n" + "!" * 80, flush=True)
        print("[bootstrap] WARNING: this worker still has the retired AURORA_REGISTER_KEY", flush=True)
        print("[bootstrap] configured. Rename it to AURORA_REGISTER_SECRET and replace it", flush=True)
        print("[bootstrap] with a NEW private operator secret. Do NOT reuse the Supabase", flush=True)
        print("[bootstrap] anon/publishable key or the old AURORA_REGISTER_KEY value.", flush=True)
        print("!" * 80 + "\n", flush=True)

    missing = [(k, hint) for k, hint in _REQUIRED_FOR_REGISTER if not os.environ.get(k, "").strip()]
    if not missing:
        print("[bootstrap] all auto-register secrets present — will self-register after setup.", flush=True)
        return
    print("\n" + "!" * 72, flush=True)
    print("[bootstrap] WARNING: missing Colab secret(s) needed to auto-register in", flush=True)
    print("Admin -> Workers. The worker will still install and serve, but it will", flush=True)
    print("NOT appear in Aurora until these are set (key icon, left sidebar -- and", flush=True)
    print("notebook access toggled ON for each) and the cell is re-run:", flush=True)
    for key, hint in missing:
        print(f"  - {key}: {hint}", flush=True)
    print("!" * 72 + "\n", flush=True)


def fetch_from_aurora(name: str, dest: str):
    """Download workers/<name> directly from your Aurora app (no GitHub needed)."""
    if os.path.exists(dest):
        os.remove(dest)
    aurora_url = os.environ.get("AURORA_URL", "").strip().rstrip("/")
    if not aurora_url:
        raise SystemExit("AURORA_URL is not set. Cannot fetch worker files.")
    url = f"{aurora_url}/api/public/workers/files/{name}"
    print(f"[bootstrap] fetching {url}", flush=True)
    urllib.request.urlretrieve(url, dest)


def setup() -> str:
    sh("pip install -q requests fastapi 'uvicorn[standard]' pyngrok 'huggingface_hub[cli]'")
    fetch_from_aurora("aurora_worker.py", f"{ROOT}/aurora_worker.py")
    fetch_from_aurora("setup.sh", f"{ROOT}/setup.sh")

    # Colab's free tier is usually a 16 GB T4 -> default to lipsync only. setup.sh
    # fails loudly if motion is requested on a <20 GB GPU rather than OOMing mid-job.
    # Normalize so "lipsync, motion" (stray spaces) can't desync what setup.sh
    # installs from what we register as capabilities.
    raw_tasks = os.environ.get("AURORA_TASKS") or "lipsync"
    tasks = ",".join(t.strip() for t in raw_tasks.split(",") if t.strip()) or "lipsync"
    os.environ["AURORA_TASKS"] = tasks
    # Register/serve exactly what we install, so Aurora never routes a job we
    # can't run (e.g. a motion job to a lipsync-only worker).
    os.environ["AURORA_CAPABILITIES"] = tasks

    sh(f"AURORA_TASKS='{tasks}' bash {ROOT}/setup.sh {ROOT}")
    os.environ["LATENTSYNC_DIR"] = f"{ROOT}/LatentSync"
    os.environ["MIMICMOTION_DIR"] = f"{ROOT}/MimicMotion"
    os.environ.setdefault("AURORA_UPLOAD", "catbox")
    return tasks


def serve_and_tunnel(tasks: str):
    # Start the FastAPI app in the background.
    server = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "aurora_worker:app",
         "--host", "0.0.0.0", "--port", "8000"],
        cwd=ROOT,
    )
    # Wait for health — and REFUSE to tunnel/register a dead endpoint (that would
    # mark a non-working worker Active in Aurora).
    healthy = False
    for _ in range(60):
        if server.poll() is not None:
            raise SystemExit(
                f"[serve] uvicorn exited early (code {server.returncode}); "
                "see the setup logs above."
            )
        try:
            urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=2)
            healthy = True
            break
        except Exception:
            time.sleep(2)
    if not healthy:
        server.terminate()
        raise SystemExit(
            "[serve] worker never became healthy on :8000 — not opening the tunnel "
            "or registering. See the logs above for the failure."
        )

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
        print("[ngrok] NGROK_STATIC_DOMAIN not set — this URL changes each restart; "
              "set it (Secrets panel) for zero-touch reconnects.", flush=True)

    # Auto-register in Aurora so no Admin -> Workers edit is needed (reuses the
    # shared worker's register helper; reads AURORA_URL + AURORA_REGISTER_SECRET).
    os.environ["NGROK_STATIC_DOMAIN"] = host or public_url.replace("https://", "")
    sys.path.insert(0, ROOT)
    try:
        from aurora_worker import register_with_aurora
        register_with_aurora()
    except Exception as e:
        print(f"[register] could not import register helper: {e}", flush=True)

    print("\n" + "=" * 64)
    print(f"Worker live (protocol=custom, caps={tasks}):")
    print(f"  Endpoint:     {public_url}/generate")
    print("  Auto-registered in Aurora if NGROK_STATIC_DOMAIN + AURORA_URL +")
    print("  AURORA_REGISTER_SECRET are set — otherwise add the URL in Admin -> Workers.")
    print("=" * 64 + "\n", flush=True)
    server.wait()


if __name__ == "__main__":
    load_colab_secrets()
    warn_if_register_secrets_missing()
    _tasks = setup()
    serve_and_tunnel(_tasks)
