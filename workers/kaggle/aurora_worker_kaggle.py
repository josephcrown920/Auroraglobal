import os
import subprocess
import sys
import time
import urllib.request

ROOT = "/kaggle/working"

CONFIG_KEYS = [
    "NGROK_AUTHTOKEN",
    "NGROK_STATIC_DOMAIN",
    "AURORA_URL",
    "AURORA_REGISTER_SECRET",
    "AURORA_WORKER_TOKEN",
    "AURORA_TASKS",
    "AURORA_UPLOAD",
    "AURORA_WORKER_NAME",
]


def load_kaggle_secrets():
    try:
        from kaggle_secrets import UserSecretsClient
    except Exception:
        return
    client = UserSecretsClient()
    for key in CONFIG_KEYS:
        if os.environ.get(key):
            continue
        try:
            value = client.get_secret(key)
        except Exception:
            value = None
        if value:
            os.environ[key] = value.strip()


def sh(cmd):
    print("$ " + cmd, flush=True)
    subprocess.run(cmd, shell=True, check=True)


def fetch_from_aurora(name, dest):
    if os.path.exists(dest):
        os.remove(dest)
    aurora_url = os.environ.get("AURORA_URL", "").strip().rstrip("/")
    if not aurora_url:
        raise SystemExit("AURORA_URL is not set. Cannot fetch worker files.")
    url = aurora_url + "/api/public/workers/files/" + name
    print("fetching " + url, flush=True)
    urllib.request.urlretrieve(url, dest)


def setup():
    sh("pip install -q requests fastapi uvicorn[standard] pyngrok huggingface_hub[cli]")
    fetch_from_aurora("aurora_worker.py", ROOT + "/aurora_worker.py")
    fetch_from_aurora("setup.sh", ROOT + "/setup.sh")

    raw_tasks = os.environ.get("AURORA_TASKS") or "lipsync"
    tasks = ",".join(t.strip() for t in raw_tasks.split(",") if t.strip()) or "lipsync"
    os.environ["AURORA_TASKS"] = tasks
    os.environ["AURORA_CAPABILITIES"] = tasks

    sh("AURORA_TASKS='" + tasks + "' bash " + ROOT + "/setup.sh " + ROOT)
    os.environ["LATENTSYNC_DIR"] = ROOT + "/LatentSync"
    os.environ["MIMICMOTION_DIR"] = ROOT + "/MimicMotion"
    os.environ.setdefault("AURORA_UPLOAD", "catbox")
    return tasks


def serve_and_tunnel(tasks):
    server = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "aurora_worker:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd=ROOT,
    )
    healthy = False
    for _ in range(60):
        if server.poll() is not None:
            raise SystemExit("uvicorn exited early, code " + str(server.returncode))
        try:
            urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=2)
            healthy = True
            break
        except Exception:
            time.sleep(2)
    if not healthy:
        server.terminate()
        raise SystemExit("worker never became healthy on port 8000")

    from pyngrok import ngrok
    token = os.environ.get("NGROK_AUTHTOKEN")
    if token:
        ngrok.set_auth_token(token)
    domain = os.environ.get("NGROK_STATIC_DOMAIN", "").strip()
    host = domain.replace("https://", "").replace("http://", "").rstrip("/")
    if host:
        ngrok.connect(addr="8000", domain=host)
        public_url = "https://" + host
    else:
        public_url = ngrok.connect(8000).public_url
        print("NGROK_STATIC_DOMAIN not set, URL changes each restart.", flush=True)

    os.environ["NGROK_STATIC_DOMAIN"] = host or public_url.replace("https://", "")
    sys.path.insert(0, ROOT)
    try:
        from aurora_worker import register_with_aurora
        register_with_aurora()
    except Exception as e:
        print("could not import register helper: " + str(e), flush=True)

    print("", flush=True)
    print("Worker live, protocol=custom, caps=" + tasks, flush=True)
    print("Endpoint: " + public_url + "/generate", flush=True)
    server.wait()


load_kaggle_secrets()
_tasks = setup()
serve_and_tunnel(_tasks)
