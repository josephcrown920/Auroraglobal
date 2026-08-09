"""
Aurora ComfyUI swarm worker — free-GPU launcher (Kaggle + Colab).

Runs **stock ComfyUI** as an Aurora backend behind a stable ngrok tunnel and
**registers itself** as `protocol=comfyui` on boot, so a free Kaggle/Colab GPU
auto-joins the orchestrator with zero Admin → Workers edits. Aurora ships the
prompt graph for every job (SDXL image, SVD/AnimateDiff video, LatentSync
lip-sync, MimicMotion motion) — this worker just needs the matching custom nodes
and model weights installed (see workers/comfyui/*.workflow.json for the exact
node class names Aurora patches against).

Run it in ONE cell with **GPU ON** + **Internet ON**:
  - Kaggle: paste this file into a cell (secrets via Add-ons → Secrets), or import
    the companion notebook, then Run All.
  - Colab: paste into a cell; set secrets via the 🔑 panel (google.colab.userdata)
    or `os.environ[...]` at the top of the cell, then run.

Secrets / env it reads (Kaggle Secrets, Colab userdata, or plain env vars):
  NGROK_AUTHTOKEN       ngrok account token (dashboard.ngrok.com)
  NGROK_STATIC_DOMAIN   free static domain, e.g. "foo-bar.ngrok-free.app"
                        (claim one at dashboard.ngrok.com/domains) — keeps the
                        registered endpoint stable across restarts.
  AURORA_URL            your Aurora base URL, e.g. "https://your-app.replit.app"
  AURORA_REGISTER_SECRET   private operator secret (the register `apikey`); set the
                        same value as AURORA_REGISTER_SECRET in Aurora's env — this
                        is NOT the Supabase anon/publishable key.
  AURORA_WORKER_NAME    (optional) row name in Admin → Workers.
  AURORA_CAPABILITIES   (optional) comma list to force which caps to serve, e.g.
                        "image,video". Default is chosen from detected VRAM:
                        <20 GB → "image,lipsync"; ≥20 GB → "image,video,lipsync,motion".
                        A cap is only ADVERTISED if its model weights are actually
                        present after setup — Aurora never routes a job we can't run.
  AURORA_INSTALL_ALL_NODES  (optional) "1" to also install the broad curated
                        custom-node set (Manager, LTX, Wan, ControlNet aux, Impact,
                        KJNodes, essentials, rgthree, WAS, IPAdapter+, frame
                        interpolation, …) plus comfy-cli for on-demand installs.
"""

import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request

# ── Platform + paths ──────────────────────────────────────────────────────────
# Kaggle writes to /kaggle/working; Colab/local use the CWD. ComfyUI is cloned in.
ROOT = "/kaggle/working" if os.path.isdir("/kaggle/working") else os.getcwd()
COMFY_DIR = os.path.join(ROOT, "ComfyUI")
PORT = 8188

CONFIG_KEYS = [
    "NGROK_AUTHTOKEN",
    "NGROK_STATIC_DOMAIN",
    "AURORA_URL",
    "AURORA_REGISTER_SECRET",
    "AURORA_REGISTER_KEY",  # retired name; loaded only so we can explain the migration
    "AURORA_WORKER_NAME",
    "AURORA_CAPABILITIES",
    "AURORA_INSTALL_ALL_NODES",
]

# Custom-node packs that provide the class names our default graphs reference.
# Core nodes (KSampler, CheckpointLoaderSimple, SVD_img2vid_Conditioning, …) ship
# with ComfyUI itself, so only the non-core packs are listed per capability.
CAP_NODE_PACKS = {
    "image": [],  # SDXL uses only core nodes.
    "video": [
        "https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite",  # VHS_VideoCombine
        "https://github.com/Kosinkadink/ComfyUI-AnimateDiff-Evolved",  # ADE_AnimateDiffLoaderGen1
        "https://github.com/sipherxyz/comfyui-art-venture",  # LoadImageFromUrl (SVD i2v)
    ],
    "lipsync": [
        "https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite",  # VideoCombine / Load*FromUrl
        "https://github.com/ShmuelRonen/ComfyUI-LatentSyncWrapper",  # LatentSyncSampler
        "https://github.com/sipherxyz/comfyui-art-venture",  # LoadAudioFromUrl / LoadVideoFromUrl
    ],
    "motion": [
        "https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite",
        "https://github.com/kijai/ComfyUI-MimicMotionWrapper",  # MimicMotionSampler
        "https://github.com/sipherxyz/comfyui-art-venture",
    ],
}

# Model weights each capability needs, as (dest_rel_path, hf_repo, hf_file). After
# setup we ADVERTISE a capability only if ALL its dest files exist on disk, so a
# missing/oversized download fails closed (Aurora won't route there) instead of
# erroring mid-job. lipsync/motion wrapper weights are large and pack-specific —
# the packs above self-download most on first run; we verify presence below.
CAP_MODELS = {
    "image": [
        ("models/checkpoints/sd_xl_base_1.0.safetensors",
         "stabilityai/stable-diffusion-xl-base-1.0", "sd_xl_base_1.0.safetensors"),
    ],
    "video": [
        # Filename MUST match the SVD graph's ckpt_name (svd-image-to-video.workflow.json).
        ("models/checkpoints/svd_xt_1_1.safetensors",
         "stabilityai/stable-video-diffusion-img2vid-xt-1-1", "svd_xt_1_1.safetensors"),
        ("models/checkpoints/v1-5-pruned-emaonly.safetensors",
         "Comfy-Org/stable-diffusion-v1-5-archive", "v1-5-pruned-emaonly-fp16.safetensors"),
        ("models/animatediff_models/mm_sd_v15_v2.ckpt",
         "guoyww/animatediff", "mm_sd_v15_v2.ckpt"),
    ],
    # lipsync/motion model weights live inside their wrapper packs (self-downloaded
    # on first graph run); these caps are gated on their node classes (see
    # CAP_NODE_CLASSES + /object_info) rather than a single weights file.
    "lipsync": [],
    "motion": [],
}

# Custom node classes each default graph references (workers/comfyui/*.json). Core
# nodes (KSampler, CheckpointLoaderSimple, SVD_img2vid_Conditioning, EmptyLatentImage,
# VAEDecode, CLIPTextEncode, SaveImage, …) ship with ComfyUI, so are not listed. A
# cap is advertised only when every class below is present in ComfyUI's loaded set.
CAP_NODE_CLASSES = {
    "image": [],
    "video": ["VHS_VideoCombine", "ADE_AnimateDiffLoaderGen1", "LoadImageFromUrl"],
    "lipsync": ["LatentSyncSampler", "LoadVideoFromUrl", "LoadAudioFromUrl", "VideoCombine", "SaveVideo"],
    "motion": ["MimicMotionSampler", "LoadImageFromUrl", "LoadVideoFromUrl", "VideoCombine", "SaveVideo"],
}


def sh(cmd: str, cwd: str | None = None, check: bool = True):
    print(f"$ {cmd}", flush=True)
    subprocess.run(cmd, shell=True, check=check, cwd=cwd)


def load_secrets():
    """Mirror Kaggle Secrets / Colab userdata into os.environ (no-op when absent).

    An explicit env var always wins, so you can override any single value inline.
    """
    # Kaggle: Secrets are NOT env vars — read them via UserSecretsClient.
    try:
        from kaggle_secrets import UserSecretsClient  # type: ignore

        client = UserSecretsClient()
        for key in CONFIG_KEYS:
            if os.environ.get(key):
                continue
            try:
                val = client.get_secret(key)
            except Exception:
                val = None
            if val:
                os.environ[key] = val.strip()
    except Exception:
        pass
    # Colab: secrets live in google.colab.userdata.
    try:
        from google.colab import userdata  # type: ignore

        for key in CONFIG_KEYS:
            if os.environ.get(key):
                continue
            try:
                val = userdata.get(key)
            except Exception:
                val = None
            if val:
                os.environ[key] = val.strip()
    except Exception:
        pass


def detect_vram_gb() -> float:
    """Best-effort GPU VRAM in GB (0.0 if torch/CUDA is unavailable)."""
    try:
        import torch  # type: ignore

        if not torch.cuda.is_available():
            return 0.0
        return torch.cuda.get_device_properties(0).total_memory / (1024**3)
    except Exception:
        return 0.0


def requested_caps() -> list[str]:
    """Caps the operator asked for, or a VRAM-appropriate default.

    Kaggle/Colab free cards are ~16 GB → image + lipsync fit. Video (SVD/AnimateDiff)
    and motion (MimicMotion) want ≥20–24 GB, so they're only defaulted on a big card.
    """
    override = os.environ.get("AURORA_CAPABILITIES", "").strip()
    if override:
        return [c.strip() for c in override.split(",") if c.strip()]
    vram = detect_vram_gb()
    print(f"[caps] detected ~{vram:.0f} GB VRAM", flush=True)
    if vram >= 20:
        return ["image", "video", "lipsync", "motion"]
    return ["image", "lipsync"]


def install_comfyui():
    # comfy-cli gives `comfy node install <pack>` (ComfyUI registry) on top of the
    # raw git-clone path below — used by the ALL_NODES option and handy for manual
    # node management inside the session.
    sh("pip install -q requests pyngrok 'huggingface_hub[cli]' comfy-cli")
    if not os.path.isdir(COMFY_DIR):
        sh(f"git clone --depth 1 https://github.com/comfyanonymous/ComfyUI '{COMFY_DIR}'")
    sh("pip install -q -r requirements.txt", cwd=COMFY_DIR)
    # manager_requirements.txt exists on current ComfyUI (0.31+) — needed when the
    # built-in Manager is enabled; harmless no-op on older checkouts.
    if os.path.exists(os.path.join(COMFY_DIR, "manager_requirements.txt")):
        sh("pip install -q -r manager_requirements.txt", cwd=COMFY_DIR, check=False)


# Broad, curated "everything" node set for AURORA_INSTALL_ALL_NODES=1: the packs
# behind Aurora's default graphs PLUS the most-used community packs (video, editing,
# control, utility). Installing the literal full registry (thousands of packs) is
# infeasible on a free session — ComfyUI-Manager is included so any remaining pack
# can be installed on demand from the UI/API.
ALL_NODE_PACKS = [
    "https://github.com/Comfy-Org/ComfyUI-Manager",
    "https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite",
    "https://github.com/Kosinkadink/ComfyUI-AnimateDiff-Evolved",
    "https://github.com/sipherxyz/comfyui-art-venture",
    "https://github.com/ShmuelRonen/ComfyUI-LatentSyncWrapper",
    "https://github.com/kijai/ComfyUI-MimicMotionWrapper",
    "https://github.com/Lightricks/ComfyUI-LTXVideo",
    "https://github.com/kijai/ComfyUI-WanVideoWrapper",
    "https://github.com/kijai/ComfyUI-KJNodes",
    "https://github.com/Fannovel16/comfyui_controlnet_aux",
    "https://github.com/ltdrdata/ComfyUI-Impact-Pack",
    "https://github.com/cubiq/ComfyUI_essentials",
    "https://github.com/rgthree/rgthree-comfy",
    "https://github.com/WASasquatch/was-node-suite-comfyui",
    "https://github.com/Fannovel16/ComfyUI-Frame-Interpolation",
    "https://github.com/cubiq/ComfyUI_IPAdapter_plus",
]


def clone_node_pack(repo: str, nodes_dir: str) -> bool:
    """Best-effort clone+deps for one custom-node pack (never aborts the boot).

    Returns True if the pack directory exists after the attempt; failures are
    printed loudly so a dead repo URL is visible in the session log instead of
    silently shrinking the installed set.
    """
    name = repo.rstrip("/").split("/")[-1]
    dest = os.path.join(nodes_dir, name)
    if os.path.isdir(dest):
        return True
    sh(f"git clone --depth 1 {repo} '{dest}'", check=False)
    if not os.path.isdir(dest):
        print(f"[nodes] WARNING: failed to clone {repo} — pack '{name}' NOT installed", flush=True)
        return False
    req = os.path.join(dest, "requirements.txt")
    if os.path.exists(req):
        sh(f"pip install -q -r '{req}'", check=False)
    return True


def install_all_node_packs():
    """AURORA_INSTALL_ALL_NODES=1 — install the broad curated pack set.

    Additive on top of the per-capability packs; capability advertisement still
    fails closed on /object_info, so a pack that fails to import never causes a
    cap to be advertised that the graphs can't actually serve.
    """
    nodes_dir = os.path.join(COMFY_DIR, "custom_nodes")
    os.makedirs(nodes_dir, exist_ok=True)
    print(f"[nodes] ALL_NODES mode: installing {len(ALL_NODE_PACKS)} packs…", flush=True)
    failed = [repo for repo in ALL_NODE_PACKS if not clone_node_pack(repo, nodes_dir)]
    if failed:
        print(f"[nodes] ALL_NODES: {len(failed)} pack(s) FAILED to install: {failed}", flush=True)
    else:
        print("[nodes] ALL_NODES: all packs installed.", flush=True)


def install_node_packs(caps: list[str]):
    nodes_dir = os.path.join(COMFY_DIR, "custom_nodes")
    os.makedirs(nodes_dir, exist_ok=True)
    seen: set[str] = set()
    for cap in caps:
        for repo in CAP_NODE_PACKS.get(cap, []):
            if repo in seen:
                continue
            seen.add(repo)
            # Best-effort: a flaky third-party clone must not abort the whole boot.
            clone_node_pack(repo, nodes_dir)


def download_models(caps: list[str]):
    from huggingface_hub import hf_hub_download  # type: ignore

    for cap in caps:
        for dest_rel, repo, fname in CAP_MODELS.get(cap, []):
            dest = os.path.join(COMFY_DIR, dest_rel)
            if os.path.exists(dest):
                continue
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            try:
                cached = hf_hub_download(repo_id=repo, filename=fname)
                shutil.copy(cached, dest)  # copy under the exact name our graph expects
                print(f"[models] {cap}: {dest_rel} ready", flush=True)
            except Exception as e:
                print(f"[models] {cap}: could not fetch {repo}/{fname}: {e}", flush=True)


def fetch_node_classes() -> set[str]:
    """Class names ComfyUI actually loaded (keys of GET /object_info).

    Used to fail closed: a cap is advertised only if every custom node its default
    graph references is genuinely loaded — not merely if a pack directory cloned (a
    pack can clone yet fail to import due to a missing dependency).
    """
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/object_info", timeout=60) as r:
            return set(json.loads(r.read().decode()).keys())
    except Exception as e:  # noqa: BLE001 — any failure means "treat as no custom nodes".
        print(f"[caps] could not read /object_info ({e}); assuming no custom nodes.", flush=True)
        return set()


def servable_caps(caps: list[str], available_classes: set[str]) -> list[str]:
    """Keep only caps whose model files AND required node classes are present.

    Fail closed: advertising a cap we can't serve would let Aurora route a job that
    errors. Model files are checked on disk; node classes against ComfyUI's loaded
    set (/object_info), matching the exact class names in workers/comfyui/*.json.
    """
    ok: list[str] = []
    for cap in caps:
        missing_models = [
            rel for rel, _, _ in CAP_MODELS.get(cap, [])
            if not os.path.exists(os.path.join(COMFY_DIR, rel))
        ]
        missing_nodes = [c for c in CAP_NODE_CLASSES.get(cap, []) if c not in available_classes]
        if missing_models:
            print(f"[caps] dropping '{cap}' — missing weights: {missing_models}", flush=True)
            continue
        if missing_nodes:
            print(f"[caps] dropping '{cap}' — missing nodes: {missing_nodes}", flush=True)
            continue
        ok.append(cap)
    return ok


def start_comfyui() -> subprocess.Popen:
    return subprocess.Popen(
        [sys.executable, "main.py", "--listen", "0.0.0.0", "--port", str(PORT)],
        cwd=COMFY_DIR,
    )


def wait_healthy(proc: subprocess.Popen, attempts: int = 90) -> bool:
    """Gate on ComfyUI's /system_stats — the same probe Aurora's health check uses.

    Refuse to tunnel/register a dead server (that would mark a broken worker Active).
    """
    for _ in range(attempts):
        if proc.poll() is not None:
            raise SystemExit(f"[serve] ComfyUI exited early (code {proc.returncode}); see logs above.")
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{PORT}/system_stats", timeout=2)
            return True
        except Exception:
            time.sleep(2)
    return False


def open_tunnel() -> str:
    from pyngrok import ngrok  # type: ignore

    token = os.environ.get("NGROK_AUTHTOKEN")
    if token:
        ngrok.set_auth_token(token)
    domain = os.environ.get("NGROK_STATIC_DOMAIN", "").strip()
    host = domain.replace("https://", "").replace("http://", "").rstrip("/")
    if host:
        ngrok.connect(addr=str(PORT), domain=host)  # pin the free static domain
        return f"https://{host}"
    public = ngrok.connect(PORT).public_url
    print("[ngrok] NGROK_STATIC_DOMAIN not set — URL changes each restart; "
          "claim a free static domain for zero-touch reconnects.", flush=True)
    return public


# Secrets required to auto-register (see the module docstring). Checked up
# front — before ComfyUI install + model downloads, which can take many
# minutes — so a missing/misspelled secret is loud immediately instead of
# discovered only after a long wait, deep inside register().
_REQUIRED_FOR_REGISTER = [
    ("NGROK_AUTHTOKEN", "ngrok dashboard -> Your Authtoken (dashboard.ngrok.com/get-started/your-authtoken)"),
    ("NGROK_STATIC_DOMAIN", "ngrok dashboard -> Domains -> claim a free static domain (dashboard.ngrok.com/domains)"),
    ("AURORA_URL", "your Aurora app base URL, e.g. https://your-app.replit.app"),
    ("AURORA_REGISTER_SECRET", "private operator secret -- set the SAME value as AURORA_REGISTER_SECRET in Aurora's env; NEVER the Supabase anon/publishable or service-role key"),
]


def warn_if_register_secrets_missing():
    """Print a loud, actionable warning before setup if auto-register can't work.

    Does not raise: the worker still serves without registering (an owner can
    add the URL by hand in Admin -> Workers), but they should know that before
    waiting through ComfyUI install + model downloads, not after.
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
    print("[bootstrap] WARNING: missing secret(s) needed to auto-register in", flush=True)
    print("Admin -> Workers. The worker will still install and serve, but it will", flush=True)
    print("NOT appear in Aurora until these are set and the cell is re-run:", flush=True)
    for key, hint in missing:
        print(f"  - {key}: {hint}", flush=True)
    print("!" * 72 + "\n", flush=True)


def register(public_url: str, caps: list[str]) -> bool:
    """Upsert this worker as protocol=comfyui via /api/public/workers/register.

    Auth = the private AURORA_REGISTER_SECRET in the `apikey` header (NOT the
    Supabase anon key — that's public). The endpoint base (…:8188 origin) is
    enough — Aurora appends /prompt, /history, /view
    itself (normalizeWorkerBase de-dupes bare-origin vs full-path registrations).
    Never raises: a registration miss must not stop the worker from serving.
    """
    aurora_url = os.environ.get("AURORA_URL", "").strip().rstrip("/")
    register_key = os.environ.get("AURORA_REGISTER_SECRET", "").strip()
    if not (aurora_url and register_key):
        print("[register] skipped — set AURORA_URL + AURORA_REGISTER_SECRET to auto-register "
              "(worker still serves jobs; add the URL in Admin → Workers).", flush=True)
        return False
    payload = {
        "name": os.environ.get("AURORA_WORKER_NAME") or "comfyui-free-gpu",
        "endpoint_url": public_url,
        "protocol": "comfyui",
        "capabilities": caps,
    }
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{aurora_url}/api/public/workers/register",
        data=body,
        headers={"apikey": register_key, "content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f"[register] OK — {public_url} registered (caps={','.join(caps)}).", flush=True)
            return 200 <= r.status < 300
    except Exception as e:
        print(f"[register] failed (worker still serving): {e}", flush=True)
        return False


def main():
    load_secrets()
    warn_if_register_secrets_missing()
    caps = requested_caps()
    print(f"[boot] requested caps: {caps}", flush=True)
    install_comfyui()
    install_node_packs(caps)
    if os.environ.get("AURORA_INSTALL_ALL_NODES", "").strip() in ("1", "true", "yes"):
        install_all_node_packs()
    download_models(caps)

    proc = start_comfyui()
    if not wait_healthy(proc):
        proc.terminate()
        raise SystemExit("[serve] ComfyUI never became healthy on /system_stats — not registering.")

    # Advertise only caps ComfyUI can truly serve: weights on disk AND the graph's
    # custom nodes actually loaded (checked against /object_info). Fail closed.
    caps = servable_caps(caps, fetch_node_classes())
    if not caps:
        proc.terminate()
        raise SystemExit("[boot] no servable capabilities after setup — check the logs above.")

    public_url = open_tunnel()
    register(public_url, caps)

    print("\n" + "=" * 64)
    print(f"ComfyUI worker live (protocol=comfyui, caps={','.join(caps)}):")
    print(f"  Endpoint: {public_url}  (Aurora sends the prompt graph)")
    print("  Keep this cell running; on restart re-run it to re-register the same row.")
    print("=" * 64 + "\n", flush=True)
    proc.wait()


if __name__ == "__main__":
    main()
