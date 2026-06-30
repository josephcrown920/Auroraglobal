#!/usr/bin/env python3
"""
Aurora Studio — self-hosted GPU worker (reference implementation).

ONE core, multiple entrypoints. This file implements the Aurora worker job
contract (see ./CONTRACT.md) for the two self-hosted tasks:

  * kind="lipsync"  -> LatentSync   (face video + driving audio -> talking video)
  * kind="motion"   -> MimicMotion  (reference image + pose video -> animated clip)

Entrypoints, all sharing process_job():
  * FastAPI : `uvicorn aurora_worker:app`              (protocol = "custom" / "vast")
  * RunPod  : `runpod.serverless.start({"handler": handler})`   (protocol = "runpod")

The HTTP/contract plumbing here is complete and provider-agnostic. The two run_*
functions shell out to the upstream inference repos — point the *_DIR / *_CKPT env
vars at your checkout (see setup.sh) and you are ready to run.
"""
from __future__ import annotations

import os
import time
import uuid
import socket
import shutil
import tempfile
import mimetypes
import subprocess
from pathlib import Path
from typing import Any

import requests

# ── Config (env-overridable) ──────────────────────────────────────────────────
LATENTSYNC_DIR = os.environ.get("LATENTSYNC_DIR", "/workspace/LatentSync")
LATENTSYNC_CKPT = os.environ.get("LATENTSYNC_CKPT", f"{LATENTSYNC_DIR}/checkpoints/latentsync_unet.pt")
LATENTSYNC_UNET = os.environ.get("LATENTSYNC_UNET_CONFIG", f"{LATENTSYNC_DIR}/configs/unet/stage2.yaml")

MIMICMOTION_DIR = os.environ.get("MIMICMOTION_DIR", "/workspace/MimicMotion")
MIMICMOTION_CKPT = os.environ.get("MIMICMOTION_CKPT", "models/MimicMotion_1-1.pth")
MIMICMOTION_BASE = os.environ.get(
    "MIMICMOTION_BASE_MODEL", "stabilityai/stable-video-diffusion-img2vid-xt-1-1"
)

WORK_DIR = Path(os.environ.get("AURORA_WORK_DIR", tempfile.gettempdir())) / "aurora"
UPLOAD_BACKEND = os.environ.get("AURORA_UPLOAD", "catbox").lower()  # catbox | 0x0 | supabase
AUTH_TOKEN = os.environ.get("AURORA_WORKER_TOKEN")  # optional bearer required on /generate

# Image generation — lazy-loaded on first request so lipsync-only workers
# don't pay the diffusers import cost. SDXL-Turbo by default (7 GB disk,
# 8 GB VRAM → fits Kaggle T4). Override with IMAGE_MODEL=black-forest-labs/FLUX.1-schnell
# on an A100/H100 (≥24 GB VRAM, ≥24 GB free disk).
IMAGE_MODEL = os.environ.get("IMAGE_MODEL") or os.environ.get("FLUX_MODEL", "stabilityai/sdxl-turbo")
IMAGE_USE_FLUX = "FLUX" in IMAGE_MODEL.upper() or "flux" in IMAGE_MODEL.lower()

WORK_DIR.mkdir(parents=True, exist_ok=True)


# ── IO helpers ────────────────────────────────────────────────────────────────
def _guess_suffix(url: str) -> str:
    ext = os.path.splitext(url.split("?")[0])[1]
    return ext or ".bin"


def _download(url: str | None, suffix: str = "") -> str:
    if not url:
        raise ValueError("missing input url")
    # Aurora sends http(s) URLs, but the HF Space (Gradio) hands us local file
    # paths / file:// URIs. Accept both: a local path is copied into WORK_DIR so
    # the rest of the pipeline is identical regardless of source.
    local = url[len("file://"):] if url.startswith("file://") else url
    if not local.startswith(("http://", "https://")) and os.path.exists(local):
        dest = WORK_DIR / f"{uuid.uuid4().hex}{suffix or os.path.splitext(local)[1]}"
        shutil.copyfile(local, dest)
        return str(dest)
    dest = WORK_DIR / f"{uuid.uuid4().hex}{suffix or _guess_suffix(url)}"
    with requests.get(url, stream=True, timeout=180) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 20):
                f.write(chunk)
    return str(dest)


def _upload(path: str) -> str:
    """Upload a result file and return a publicly fetchable URL (Aurora re-fetches it)."""
    if UPLOAD_BACKEND == "supabase":
        return _upload_supabase(path)
    if UPLOAD_BACKEND == "0x0":
        with open(path, "rb") as f:
            r = requests.post("https://0x0.st", files={"file": f}, timeout=180)
        r.raise_for_status()
        return r.text.strip()
    # default: catbox.moe — no account, permanent links
    with open(path, "rb") as f:
        r = requests.post(
            "https://catbox.moe/user/api.php",
            data={"reqtype": "fileupload"},
            files={"fileToUpload": f},
            timeout=180,
        )
    r.raise_for_status()
    return r.text.strip()


def _upload_supabase(path: str) -> str:
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    bucket = os.environ.get("SUPABASE_BUCKET", "studio")
    name = f"worker/{uuid.uuid4().hex}{os.path.splitext(path)[1]}"
    ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
    with open(path, "rb") as f:
        r = requests.post(
            f"{base}/storage/v1/object/{bucket}/{name}",
            headers={
                "authorization": f"Bearer {key}",
                "content-type": ctype,
                "x-upsert": "true",
            },
            data=f.read(),
            timeout=300,
        )
    r.raise_for_status()
    return f"{base}/storage/v1/object/public/{bucket}/{name}"


def _newest(paths) -> str | None:
    paths = sorted(paths, key=lambda p: p.stat().st_mtime)
    return str(paths[-1]) if paths else None


def _ffprobe_duration(path: str) -> float:
    """Media duration in seconds (0.0 when unknown)."""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            capture_output=True, text=True, check=True,
        )
        return float((out.stdout or "").strip() or 0.0)
    except Exception:
        return 0.0


# ── Inference ─────────────────────────────────────────────────────────────────
def run_latentsync(video_url: str, audio_url: str, params: dict[str, Any]) -> str:
    """LatentSync: re-render the mouth of `video_url` to match `audio_url`."""
    video = _download(video_url, ".mp4")
    audio = _download(audio_url, ".wav")
    out = str(WORK_DIR / f"{uuid.uuid4().hex}_lipsync.mp4")
    cmd = [
        "python", "-m", "scripts.inference",
        "--unet_config_path", LATENTSYNC_UNET,
        "--inference_ckpt_path", LATENTSYNC_CKPT,
        "--inference_steps", str(int(params.get("inference_steps", 20))),
        "--guidance_scale", str(float(params.get("guidance_scale", 1.5))),
        "--seed", str(int(params.get("seed", 1247))),
        "--video_path", video,
        "--audio_path", audio,
        "--video_out_path", out,
    ]
    subprocess.run(cmd, cwd=LATENTSYNC_DIR, check=True)
    return out


def run_mimicmotion(image_url: str, video_url: str, params: dict[str, Any]) -> str:
    """MimicMotion: animate reference `image_url` to follow pose video `video_url`."""
    image = _download(image_url, ".jpg")
    video = _download(video_url, ".mp4")
    out_dir = Path(MIMICMOTION_DIR) / "outputs"
    out_dir.mkdir(parents=True, exist_ok=True)
    cfg_yaml = WORK_DIR / f"{uuid.uuid4().hex}_mimic.yaml"
    cfg_yaml.write_text(
        f"base_model_path: {MIMICMOTION_BASE}\n"
        f"ckpt_path: {MIMICMOTION_CKPT}\n"
        "test_case:\n"
        f"  - ref_video_path: {video}\n"
        f"    ref_image_path: {image}\n"
        f"    num_frames: {int(params.get('frames', 72))}\n"
        f"    resolution: {int(params.get('resolution', 576))}\n"
        "    frames_overlap: 6\n"
        f"    num_inference_steps: {int(params.get('steps', 25))}\n"
        "    noise_aug_strength: 0\n"
        f"    guidance_scale: {float(params.get('cfg', 2.0))}\n"
        "    sample_stride: 2\n"
        f"    fps: {int(params.get('fps', 15))}\n"
        f"    seed: {int(params.get('seed', 42))}\n"
    )
    before = set(out_dir.glob("*.mp4"))
    subprocess.run(
        ["python", "inference.py", "--inference_config", str(cfg_yaml)],
        cwd=MIMICMOTION_DIR,
        check=True,
    )
    new = _newest(set(out_dir.glob("*.mp4")) - before) or _newest(out_dir.glob("*.mp4"))
    if not new:
        raise RuntimeError("MimicMotion produced no output")
    return new


# ── Image generation (SDXL-Turbo or FLUX.1-schnell via diffusers) ─────────────
_image_pipe = None  # cached for the worker's lifetime (lazy-loaded on first request)


def _get_image_pipe():
    """Lazy-load and cache the image pipeline. Raises RuntimeError if unavailable."""
    global _image_pipe
    if _image_pipe is not None:
        return _image_pipe
    try:
        import torch
        from diffusers import AutoPipelineForText2Image, FluxPipeline
    except ImportError as e:
        raise RuntimeError(
            f"diffusers not installed (run: pip install diffusers transformers accelerate safetensors): {e}"
        ) from e

    print(f"[image] loading {IMAGE_MODEL} …", flush=True)
    if IMAGE_USE_FLUX:
        pipe = FluxPipeline.from_pretrained(IMAGE_MODEL, torch_dtype=torch.bfloat16)
        pipe.enable_sequential_cpu_offload()   # ~4-6 GB VRAM usage via layer-by-layer offload
    else:
        # SDXL-Turbo: baked into a single AutoPipeline call; FP16 on CUDA or CPU fallback.
        device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if device == "cuda" else torch.float32
        pipe = AutoPipelineForText2Image.from_pretrained(
            IMAGE_MODEL, torch_dtype=dtype, variant="fp16" if device == "cuda" else None
        )
        pipe = pipe.to(device)

    _image_pipe = pipe
    print(f"[image] {IMAGE_MODEL} ready.", flush=True)
    return pipe


def run_image(prompt: str, params: dict[str, Any]) -> str:
    """Generate an image from a text prompt. Returns a local file path."""
    import torch
    pipe = _get_image_pipe()

    width = int(params.get("width", 768))
    height = int(params.get("height", 1344))  # 9:16 portrait default
    steps = int(params.get("steps", params.get("num_inference_steps", 4 if IMAGE_USE_FLUX else 4)))
    seed = params.get("seed")
    generator = torch.Generator().manual_seed(int(seed)) if seed is not None else None

    if IMAGE_USE_FLUX:
        result = pipe(
            prompt=prompt or "a beautiful image",
            height=height,
            width=width,
            num_inference_steps=steps,
            guidance_scale=0.0,   # FLUX-schnell is CFG-distilled
            max_sequence_length=256,
            generator=generator,
        )
    else:
        # SDXL-Turbo: guidance_scale=0, 1-4 steps optimal
        result = pipe(
            prompt=prompt or "a beautiful image",
            height=height,
            width=width,
            num_inference_steps=steps,
            guidance_scale=0.0,
            generator=generator,
        )

    out = str(WORK_DIR / f"{uuid.uuid4().hex}_image.png")
    result.images[0].save(out)
    return out


# ── Final assembly (ffmpeg only — no model weights) ───────────────────────────
ASSEMBLE_W = int(os.environ.get("AURORA_ASSEMBLE_W", "720"))
ASSEMBLE_H = int(os.environ.get("AURORA_ASSEMBLE_H", "1280"))
ASSEMBLE_FPS = int(os.environ.get("AURORA_ASSEMBLE_FPS", "24"))
ASSEMBLE_MAX_SCENES = int(os.environ.get("AURORA_ASSEMBLE_MAX_SCENES", "12"))


def run_assemble(params: dict[str, Any]) -> str:
    """Stitch a faceless kids story into one MP4.

    For each scene the picture is normalized to a single canvas/fps and its
    narration becomes the scene's audio — the picture is freeze-extended or
    trimmed so voice and picture stay in sync. Scenes are concatenated in order
    and a looped, ducked music bed is mixed underneath. ffmpeg-only, so any
    worker with ffmpeg can advertise the `assemble` capability.
    """
    clips = params.get("clips") or []
    narrations = params.get("narrations") or []
    durations = params.get("durations") or []
    music_url = params.get("music_url")
    music_volume = float(params.get("music_volume", 0.18))

    if not clips:
        raise ValueError("assemble requires at least one clip")
    if len(clips) > ASSEMBLE_MAX_SCENES:
        raise ValueError(f"assemble: too many scenes ({len(clips)} > {ASSEMBLE_MAX_SCENES})")
    for u in clips:
        if not isinstance(u, str) or not u.startswith(("http://", "https://")):
            raise ValueError("assemble: every clip must be an http(s) url")

    scene_files: list[str] = []
    for i, clip_url in enumerate(clips):
        clip = _download(clip_url, ".mp4")
        narr_url = narrations[i] if i < len(narrations) else None
        narr = _download(narr_url, ".wav") if narr_url else None
        # Scene length follows the narration when present, else the requested or
        # probed clip duration.
        req = float(durations[i]) if i < len(durations) and durations[i] else 0.0
        if narr:
            dur = _ffprobe_duration(narr) or req or _ffprobe_duration(clip) or 5.0
        else:
            dur = req or _ffprobe_duration(clip) or 5.0
        dur = max(0.5, min(dur, 60.0))

        scene_out = str(WORK_DIR / f"{uuid.uuid4().hex}_scene{i}.mp4")
        # Over-pad (clone last frame) then hard-trim to `dur`: longer clips are
        # trimmed, shorter clips freeze on their final frame to fill the voice.
        vf = (
            f"scale={ASSEMBLE_W}:{ASSEMBLE_H}:force_original_aspect_ratio=decrease,"
            f"pad={ASSEMBLE_W}:{ASSEMBLE_H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={ASSEMBLE_FPS},"
            f"tpad=stop_mode=clone:stop_duration={dur:.3f},format=yuv420p"
        )
        cmd = ["ffmpeg", "-y", "-i", clip]
        if narr:
            cmd += ["-i", narr, "-filter_complex", f"[0:v]{vf}[v]", "-map", "[v]", "-map", "1:a"]
        else:
            # Silent stereo track so every scene exposes matching streams for concat.
            cmd += ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
                    "-filter_complex", f"[0:v]{vf}[v]", "-map", "[v]", "-map", "1:a"]
        cmd += ["-t", f"{dur:.3f}", "-c:v", "libx264", "-preset", "veryfast",
                "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-ac", "2", scene_out]
        subprocess.run(cmd, check=True)
        scene_files.append(scene_out)

    # Concat scenes (identical codecs/canvas/fps) in order.
    list_path = WORK_DIR / f"{uuid.uuid4().hex}_concat.txt"
    list_path.write_text("".join(f"file '{p}'\n" for p in scene_files))
    concat_out = str(WORK_DIR / f"{uuid.uuid4().hex}_concat.mp4")
    subprocess.run(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(list_path),
         "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-ar", "48000", "-ac", "2", concat_out],
        check=True,
    )

    if not music_url:
        return concat_out

    # Mix a looped, ducked music bed under the narration for the full duration.
    music = _download(music_url, ".mp3")
    final_out = str(WORK_DIR / f"{uuid.uuid4().hex}_final.mp4")
    subprocess.run(
        ["ffmpeg", "-y", "-i", concat_out, "-stream_loop", "-1", "-i", music,
         "-filter_complex",
         f"[1:a]volume={music_volume}[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=0[a]",
         "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-shortest", final_out],
        check=True,
    )
    return final_out


# ── Core dispatch (shared by every entrypoint) ────────────────────────────────
def process_job(job: dict[str, Any]) -> dict[str, str]:
    kind = (job.get("kind") or "").lower()
    params = job.get("params") or {}
    image_urls = job.get("image_urls") or []

    if kind == "lipsync":
        face = job.get("video_url") or (image_urls[0] if image_urls else None)
        out = run_latentsync(face, job.get("audio_url"), params)
    elif kind == "motion":
        ref = image_urls[0] if image_urls else None
        out = run_mimicmotion(ref, job.get("video_url"), params)
    elif kind == "assemble":
        out = run_assemble(params)
    elif kind == "image":
        out = run_image(job.get("prompt") or "", params)
    else:
        raise ValueError(
            f"unsupported kind {kind!r}; this worker serves: lipsync, motion, assemble, image"
        )

    return {"url": _upload(out)}


# ── Self-registration (zero-touch Colab/Kaggle restarts) ──────────────────────
def _worker_name() -> str:
    """Stable, human-readable worker name (override with AURORA_WORKER_NAME)."""
    return os.environ.get("AURORA_WORKER_NAME") or f"colab-{socket.gethostname()}"


def _capabilities() -> list[str]:
    """Tasks this worker actually serves, from AURORA_CAPABILITIES (comma list).

    When AURORA_CAPABILITIES is set it is honored verbatim (operator override).
    Otherwise the default is the two self-hosted GPU tasks PLUS `assemble` — the
    ffmpeg-only kids-story stitch — whenever ffmpeg is on PATH. Any worker that can
    run lipsync/motion already has ffmpeg (both paths shell out to ffmpeg/ffprobe),
    so the default worker advertises assemble with zero extra setup; without this,
    Aurora's assemble preflight rejects every kids story up front.

    Constrained hosts (e.g. a 16 GB Kaggle GPU that only installs LatentSync) set
    AURORA_CAPABILITIES=lipsync so Aurora never routes a job the worker can't run —
    registration and /health both report the same set.
    """
    raw = os.environ.get("AURORA_CAPABILITIES", "").strip()
    if raw:
        caps = [c.strip() for c in raw.split(",") if c.strip()]
        if caps:
            return caps
    # Unset/empty → default. Dynamically include tasks whose dependencies are
    # installed. assemble needs only ffmpeg; image needs diffusers.
    default = ["lipsync", "motion"]
    if shutil.which("ffmpeg"):
        default.append("assemble")
    # Include "image" when diffusers is importable (setup.sh image task was run)
    # OR when IMAGE_MODEL is explicitly overridden — let the caller opt in.
    try:
        import importlib
        if importlib.util.find_spec("diffusers") is not None:
            default.append("image")
    except Exception:
        pass
    return default


def register_with_aurora() -> bool:
    """Upsert this worker's row in Aurora's gpu_workers table.

    Reads the stable Ngrok domain + Aurora URL + register key from env and POSTs
    to `${AURORA_URL}/api/public/workers/register`. Auth is the Supabase
    anon/publishable key sent as the `apikey` header (same pattern as the health /
    jobs-tick cron routes) — so the worker never needs a Supabase service key.

    Env:
      NGROK_STATIC_DOMAIN  your free Ngrok static domain, e.g. "foo-bar.ngrok-free.app"
      AURORA_URL           base URL of the Aurora app, e.g. "https://aurora.example.com"
      AURORA_REGISTER_KEY  Supabase anon/publishable key (the `apikey` header value)
      AURORA_WORKER_TOKEN  (optional) this worker's /generate bearer; sent as auth_token

    Never raises: a registration failure must not stop the worker from serving.
    Returns True on success, False otherwise.
    """
    domain = os.environ.get("NGROK_STATIC_DOMAIN", "").strip()
    aurora_url = os.environ.get("AURORA_URL", "").strip().rstrip("/")
    register_key = os.environ.get("AURORA_REGISTER_KEY", "").strip()
    if not (domain and aurora_url and register_key):
        print(
            "[register] skipped — set NGROK_STATIC_DOMAIN, AURORA_URL and "
            "AURORA_REGISTER_KEY to auto-register (worker still serves jobs).",
            flush=True,
        )
        return False

    # Accept a bare domain or a full URL; the worker always serves /generate.
    host = domain.replace("https://", "").replace("http://", "").rstrip("/")
    endpoint_url = f"https://{host}/generate"
    payload: dict[str, Any] = {
        "name": _worker_name(),
        "endpoint_url": endpoint_url,
        "protocol": "custom",
        "capabilities": _capabilities(),
    }
    if AUTH_TOKEN:
        payload["auth_token"] = AUTH_TOKEN

    try:
        r = requests.post(
            f"{aurora_url}/api/public/workers/register",
            json=payload,
            headers={"apikey": register_key, "content-type": "application/json"},
            timeout=30,
        )
    except Exception as e:  # network error — log, keep serving
        print(f"[register] error (worker still serving): {e}", flush=True)
        return False
    if r.ok:
        print(f"[register] OK — {endpoint_url} registered with Aurora.", flush=True)
        return True
    print(f"[register] failed {r.status_code}: {r.text.strip()[:300]}", flush=True)
    return False


def auto_register_when_ready(port: int = 8000, attempts: int = 60) -> None:
    """Wait until the local FastAPI /health answers, then self-register once."""
    for _ in range(attempts):
        try:
            requests.get(f"http://127.0.0.1:{port}/health", timeout=2)
            break
        except Exception:
            time.sleep(1)
    register_with_aurora()


# ── Entrypoint A: FastAPI (protocol = custom / vast) ──────────────────────────
try:
    from fastapi import FastAPI, HTTPException, Request

    app: "FastAPI | None" = FastAPI(title="Aurora GPU worker", version="1.0")

    @app.get("/health")
    def health():
        return {"ok": True, "tasks": _capabilities()}

    @app.post("/generate")
    async def generate(req: Request):
        if AUTH_TOKEN and req.headers.get("authorization") != f"Bearer {AUTH_TOKEN}":
            raise HTTPException(status_code=401, detail="unauthorized")
        job = await req.json()
        try:
            return process_job(job)
        except Exception as e:  # surface a real error to Aurora (no silent fallback)
            raise HTTPException(status_code=500, detail=str(e))

except ImportError:  # FastAPI not installed (e.g. a RunPod-only image)
    app = None


# ── Entrypoint B: RunPod Serverless (protocol = runpod) ───────────────────────
def handler(event: dict[str, Any]) -> dict[str, str]:
    return process_job(event.get("input") or {})


if __name__ == "__main__":
    # `python aurora_worker.py` → run the FastAPI server locally.
    import threading
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    # Auto-register once the server answers /health — zero-touch Colab/Kaggle
    # restarts. Runs in a daemon thread so a slow/failing register never blocks
    # serving; uvicorn keeps the main thread.
    threading.Thread(target=auto_register_when_ready, args=(port,), daemon=True).start()
    uvicorn.run(app, host="0.0.0.0", port=port)
