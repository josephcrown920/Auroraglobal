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
import uuid
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
    else:
        raise ValueError(
            f"unsupported kind {kind!r}; this worker serves 'lipsync' + 'motion'"
        )

    return {"url": _upload(out)}


# ── Entrypoint A: FastAPI (protocol = custom / vast) ──────────────────────────
try:
    from fastapi import FastAPI, HTTPException, Request

    app: "FastAPI | None" = FastAPI(title="Aurora GPU worker", version="1.0")

    @app.get("/health")
    def health():
        return {"ok": True, "tasks": ["lipsync", "motion"]}

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
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
