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
import hashlib
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
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff", ".avif"}


def _guess_suffix(url: str) -> str:
    ext = os.path.splitext(url.split("?")[0])[1]
    return ext or ".bin"


def _looks_like_image(path: str) -> bool:
    """True when `path`'s extension OR ffprobe's own codec_type say "image",
    not video. Aurora's Studio UI lets users drop a still photo as the
    lipsync "performance source" (accept="video/*,image/*") — LatentSync's
    CLI needs an actual multi-frame video, so callers must convert first."""
    if os.path.splitext(path)[1].lower() in IMAGE_EXTS:
        return True
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=codec_type,nb_frames",
             "-of", "default=noprint_wrappers=1", path],
            capture_output=True, text=True, timeout=20,
        )
        info = out.stdout or ""
        if "codec_type=video" not in info:
            return True
        # A single-frame "video" (e.g. a still re-muxed by some pickers) is
        # still effectively an image for LatentSync's purposes.
        for line in info.splitlines():
            if line.startswith("nb_frames="):
                n = line.split("=", 1)[1].strip()
                if n.isdigit() and int(n) <= 1:
                    return True
    except Exception:
        pass
    return False


def _image_to_video(image_path: str, seconds: float = 6.0, fps: int = 25) -> str:
    """Loop a still photo into a short silent video so image-only inputs
    (still photo of a face) can feed the same LatentSync pipeline as a real
    talking-head clip."""
    out = str(WORK_DIR / f"{uuid.uuid4().hex}_stillvid.mp4")
    subprocess.run(
        [
            "ffmpeg", "-y", "-loop", "1", "-i", image_path,
            "-t", str(seconds), "-r", str(fps),
            "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            "-pix_fmt", "yuv420p", "-c:v", "libx264",
            out,
        ],
        check=True, capture_output=True,
    )
    return out


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
    """LatentSync: re-render the mouth of `video_url` to match `audio_url`.

    `video_url` may actually be a still photo — Aurora's Studio UI accepts
    "video/*,image/*" for this slot. Download preserving the real extension
    (not a forced .mp4) so we can detect that case, then loop the photo into
    a short silent clip before handing it to LatentSync's CLI, which only
    understands real multi-frame video containers.
    """
    video_raw = _download(video_url, _guess_suffix(video_url))
    video = _image_to_video(video_raw) if _looks_like_image(video_raw) else video_raw
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
ASSEMBLE_FPS = int(os.environ.get("AURORA_ASSEMBLE_FPS", "24"))
ASSEMBLE_MAX_SCENES = int(os.environ.get("AURORA_ASSEMBLE_MAX_SCENES", "12"))

# Supported aspect ratios and their canvas dimensions (all even-pixel,
# yuv420p-safe). Keep in lockstep with ASSEMBLE_CANVAS / resolveAssembleCanvas
# in src/lib/autocut.server.ts.
ASSEMBLE_CANVAS: dict[str, tuple[int, int]] = {
    "9:16": (720,  1280),  # portrait  (default)
    "16:9": (1280, 720),   # landscape
    "1:1":  (720,  720),   # square
}


def _resolve_assemble_canvas(aspect: str | None) -> tuple[int, int]:
    """Return (width, height) for the requested aspect ratio.
    Raises ValueError with a clear message (matched by TERMINAL_ERROR_RE on the
    Aurora server) when an unsupported ratio is requested."""
    ratio = aspect or "9:16"
    canvas = ASSEMBLE_CANVAS.get(ratio)
    if canvas is None:
        supported = ", ".join(ASSEMBLE_CANVAS)
        raise ValueError(
            f"AutoCut: unsupported aspect ratio \"{ratio}\" "
            f"[requires one of {supported}]"
        )
    return canvas

# AutoCut style id -> per-clip duration bounds + transition. Mirrors
# CUT_RATE_BOUNDS / getStyleCutRule() in src/lib/autocut.server.ts (that file
# can't be imported from Python, so keep the two definitions in lockstep).
STYLE_CUT_RULES: dict[str, dict[str, Any]] = {
    # hype/tiktok_hook both use cutRate "fast" in autocut.server.ts's AUTOCUT_STYLES,
    # cinematic uses "slow", talking_head uses "medium" — bounds below mirror
    # CUT_RATE_BOUNDS there exactly, not the individual style ids.
    "hype": {"min": 0.6, "max": 1.5, "transition": "cut"},
    "cinematic": {"min": 3.0, "max": 5.0, "transition": "crossfade"},
    "talking_head": {"min": 4.0, "max": 8.0, "transition": "cut"},
    "tiktok_hook": {"min": 0.6, "max": 1.5, "transition": "cut"},
}
DEFAULT_CUT_RULE = {"min": 0.5, "max": 8.0, "transition": "cut"}
ASSEMBLE_CROSSFADE_SEC = 0.8


def _has_audio_stream(path: str) -> bool:
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "a",
             "-show_entries", "stream=index", "-of", "csv=p=0", path],
            capture_output=True, text=True, check=True,
        )
        return bool((out.stdout or "").strip())
    except Exception:
        return False


def _xfade_merge_scenes(scenes: list[tuple[str, float]], crossfade_sec: float) -> str:
    """Sequentially crossfades (path, duration) scenes into one file via
    ffmpeg's xfade/acrossfade filters, mirroring xfadeMergeScenes() in
    autocut.server.ts."""
    acc_path, acc_dur = scenes[0]
    for path, dur in scenes[1:]:
        cf = max(0.1, min(crossfade_sec, acc_dur - 0.1, dur - 0.1))
        offset = max(0.0, acc_dur - cf)
        out = str(WORK_DIR / f"{uuid.uuid4().hex}_xfade.mp4")
        subprocess.run(
            ["ffmpeg", "-y", "-i", acc_path, "-i", path,
             "-filter_complex",
             f"[0:v][1:v]xfade=transition=fade:duration={cf:.3f}:offset={offset:.3f}[v];"
             f"[0:a][1:a]acrossfade=d={cf:.3f}[a]",
             "-map", "[v]", "-map", "[a]",
             "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-ar", "48000", "-ac", "2", out],
            check=True,
        )
        acc_path, acc_dur = out, acc_dur + dur - cf
    return acc_path


def run_assemble(params: dict[str, Any]) -> str:
    """Stitch either a faceless kids story (picture + narration) or an AutoCut
    edit (the user's own footage) into one MP4.

    Kids story: each scene's picture is normalized to a single canvas/fps and
    its narration becomes the scene's audio, freeze-extended/trimmed to match.
    AutoCut (`style` present, no narration): each clip's OWN audio is kept —
    silencing it would drop real speech/ambience from the user's footage — and
    scene length/transition follow the chosen style's cut-point rule (see
    STYLE_CUT_RULES) instead of a narration track.

    Either way, scenes are concatenated (or crossfaded, for styles that call
    for it) in order and a looped, ducked music bed is mixed underneath, then
    the result is hard-trimmed to `max_duration`. ffmpeg-only, so any worker
    with ffmpeg can advertise the `assemble` capability.
    """
    clips = params.get("clips") or []
    narrations = params.get("narrations") or []
    durations = params.get("durations") or []
    style = params.get("style")
    aspect = params.get("aspect")  # "9:16" | "16:9" | "1:1" | None → default 9:16
    music_url = params.get("music_url")
    music_volume = float(params.get("music_volume", 0.18))
    max_duration = float(params.get("max_duration", 60.0))

    if not clips:
        raise ValueError("assemble requires at least one clip")
    if len(clips) > ASSEMBLE_MAX_SCENES:
        raise ValueError(f"assemble: too many scenes ({len(clips)} > {ASSEMBLE_MAX_SCENES})")
    for u in clips:
        if not isinstance(u, str) or not u.startswith(("http://", "https://")):
            raise ValueError("assemble: every clip must be an http(s) url")

    # Resolve output canvas — raises ValueError (matched by TERMINAL_ERROR_RE)
    # for unsupported ratios so the job fails visibly rather than silently
    # producing the wrong aspect ratio.
    assemble_w, assemble_h = _resolve_assemble_canvas(aspect)

    cut_rule = STYLE_CUT_RULES.get(style, DEFAULT_CUT_RULE) if style else DEFAULT_CUT_RULE

    scenes: list[tuple[str, float]] = []
    for i, clip_url in enumerate(clips):
        clip = _download(clip_url, ".mp4")
        narr_url = narrations[i] if i < len(narrations) else None
        narr = _download(narr_url, ".wav") if narr_url else None
        req = float(durations[i]) if i < len(durations) and durations[i] else 0.0
        if narr:
            # Kids story: scene length follows the narration track.
            dur = _ffprobe_duration(narr) or req or _ffprobe_duration(clip) or 5.0
            dur = max(0.5, min(dur, 60.0))
        else:
            # AutoCut: trim/freeze-extend to the style's cut-point bounds.
            probed = req or _ffprobe_duration(clip) or cut_rule["max"]
            dur = max(cut_rule["min"], min(probed, cut_rule["max"]))
        with_audio = (not narr) and _has_audio_stream(clip)

        scene_out = str(WORK_DIR / f"{uuid.uuid4().hex}_scene{i}.mp4")
        # Over-pad (clone last frame) then hard-trim to `dur`: longer clips are
        # trimmed, shorter clips freeze on their final frame.
        vf = (
            f"scale={assemble_w}:{assemble_h}:force_original_aspect_ratio=decrease,"
            f"pad={assemble_w}:{assemble_h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={ASSEMBLE_FPS},"
            f"tpad=stop_mode=clone:stop_duration={dur:.3f},format=yuv420p"
        )
        cmd = ["ffmpeg", "-y", "-i", clip]
        if narr:
            cmd += ["-i", narr, "-filter_complex", f"[0:v]{vf}[v]", "-map", "[v]", "-map", "1:a"]
        elif with_audio:
            # AutoCut with its own audio: keep the clip's real audio track.
            cmd += ["-filter_complex", f"[0:v]{vf}[v]", "-map", "[v]", "-map", "0:a"]
        else:
            # No narration and no audio stream: pad with silence so every scene
            # exposes matching streams for concat/xfade.
            cmd += ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
                    "-filter_complex", f"[0:v]{vf}[v]", "-map", "[v]", "-map", "1:a"]
        cmd += ["-t", f"{dur:.3f}", "-c:v", "libx264", "-preset", "veryfast",
                "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-ac", "2", scene_out]
        subprocess.run(cmd, check=True)
        scenes.append((scene_out, dur))

    if cut_rule["transition"] == "crossfade" and len(scenes) > 1:
        concat_out = _xfade_merge_scenes(scenes, ASSEMBLE_CROSSFADE_SEC)
    else:
        list_path = WORK_DIR / f"{uuid.uuid4().hex}_concat.txt"
        list_path.write_text("".join(f"file '{p}'\n" for p, _ in scenes))
        concat_out = str(WORK_DIR / f"{uuid.uuid4().hex}_concat.mp4")
        subprocess.run(
            ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(list_path),
             "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-ar", "48000", "-ac", "2", concat_out],
            check=True,
        )

    if music_url:
        # Mix a looped, ducked music bed under the scene audio for the full duration.
        music = _download(music_url, ".mp3")
        final_out = str(WORK_DIR / f"{uuid.uuid4().hex}_final.mp4")
        subprocess.run(
            ["ffmpeg", "-y", "-i", concat_out, "-stream_loop", "-1", "-i", music,
             "-filter_complex",
             f"[1:a]volume={music_volume}[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=0[a]",
             "-map", "0:v", "-map", "[a]",
             "-t", f"{max_duration:.3f}",
             "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac",
             "-shortest", final_out],
            check=True,
        )
        return final_out

    # No music: still hard-trim to max_duration so an over-long assembly never
    # slips past the contract's "≤60s" bound.
    trimmed_out = str(WORK_DIR / f"{uuid.uuid4().hex}_trimmed.mp4")
    subprocess.run(
        ["ffmpeg", "-y", "-i", concat_out, "-t", f"{max_duration:.3f}", "-c", "copy", trimmed_out],
        check=True,
    )
    return trimmed_out


# ── Lyric video (ffmpeg + libass only — no model weights) ─────────────────────
# Burns user-timed lyric lines over a generated background and muxes the
# uploaded song underneath. Distinct from `caption_burn`, which overlays cues
# onto an EXISTING video — this SYNTHESIZES the video from just audio + text.
LYRIC_VIDEO_W = int(os.environ.get("AURORA_LYRICVIDEO_W", "720"))
LYRIC_VIDEO_H = int(os.environ.get("AURORA_LYRICVIDEO_H", "1280"))
LYRIC_VIDEO_FPS = int(os.environ.get("AURORA_LYRICVIDEO_FPS", "24"))
# Long input keeps the ffmpeg job (and the worker's request timeout) bounded.
LYRIC_VIDEO_MAX_SECONDS = float(os.environ.get("AURORA_LYRICVIDEO_MAX_SECONDS", "360"))

# Rough mood backgrounds matching MUSIC_VIDEO_STYLES on the frontend — a plain
# solid color is deliberate (no extra model weights); style is cosmetic only.
LYRIC_VIDEO_BG_COLORS = {
    "trap": "0x18181b",
    "afrobeats": "0x451a03",
    "drill": "0x0f172a",
    "luxury": "0x422006",
}
LYRIC_VIDEO_DEFAULT_BG = "0x0a0a12"


def _format_srt_timestamp(seconds: float) -> str:
    ms = int(round(max(0.0, seconds) * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _write_srt(segments: list[dict[str, Any]], path: Path) -> int:
    """Write timed lyric lines as an SRT file. Returns the number of cues written.

    The lyric TEXT never touches the ffmpeg command line or filter graph — it
    only ever lands in this file, which the `subtitles=` filter reads by path.
    That is the injection defense: free-text lyrics can contain anything
    (quotes, colons, filter-looking syntax) and it still can't escape into the
    ffmpeg argv the way a per-line `drawtext` filter string could.
    """
    lines: list[str] = []
    cue = 0
    for seg in segments:
        start = float(seg.get("start", 0) or 0)
        end = float(seg.get("end", 0) or 0)
        if end <= start:
            end = start + 2.5
        text = str(seg.get("text", "")).replace("\r", " ").replace("\n", " ").strip()
        if not text:
            continue
        cue += 1
        lines.append(str(cue))
        lines.append(f"{_format_srt_timestamp(start)} --> {_format_srt_timestamp(end)}")
        lines.append(text)
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")
    return cue


def _ffmpeg_escape_filter_path(path: str) -> str:
    """Escape a filesystem path for embedding inside an ffmpeg filtergraph
    option (subtitles=<path>). Colons and backslashes are filtergraph
    metacharacters; our paths are worker-generated UUIDs so this is a
    defensive no-op in practice, not a trust boundary."""
    return path.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def run_lyric_video(audio_url: str | None, segments: list[dict[str, Any]], params: dict[str, Any]) -> str:
    """Synthesize a lyric video: a generated background with the user's timed
    lyric lines burned in via the ffmpeg `subtitles` filter (libass), muxed
    with the uploaded song. ffmpeg-only, so any worker with ffmpeg + libass
    can advertise the `lyric_video` capability — mirrors run_assemble's
    ffmpeg-only design.
    """
    if not audio_url:
        raise ValueError("lyric_video requires audio_url")
    if not segments:
        raise ValueError("lyric_video requires at least one lyric segment")

    audio = _download(audio_url, ".mp3")
    duration = _ffprobe_duration(audio)
    if duration <= 0:
        raise RuntimeError("Could not read the song's duration — unsupported or corrupt audio file")
    if duration > LYRIC_VIDEO_MAX_SECONDS:
        raise ValueError(
            f"Song is too long ({duration:.0f}s > {LYRIC_VIDEO_MAX_SECONDS:.0f}s max) for a lyric video"
        )

    srt_path = WORK_DIR / f"{uuid.uuid4().hex}_lyrics.srt"
    if _write_srt(segments, srt_path) == 0:
        raise ValueError("lyric_video: every segment had empty text")

    style = str(params.get("style") or "").lower()
    bg_color = LYRIC_VIDEO_BG_COLORS.get(style, LYRIC_VIDEO_DEFAULT_BG)
    srt_arg = _ffmpeg_escape_filter_path(str(srt_path))
    out = str(WORK_DIR / f"{uuid.uuid4().hex}_lyricvideo.mp4")

    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", f"color=c={bg_color}:s={LYRIC_VIDEO_W}x{LYRIC_VIDEO_H}:r={LYRIC_VIDEO_FPS}",
        "-i", audio,
        "-filter_complex",
        f"[0:v]format=yuv420p,subtitles={srt_arg}:force_style="
        "'Fontsize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,"
        "BorderStyle=1,Outline=2,Alignment=2,MarginV=80'[v]",
        "-map", "[v]", "-map", "1:a",
        "-t", f"{duration:.3f}",
        "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-ar", "48000", "-ac", "2",
        "-shortest",
        out,
    ]
    subprocess.run(cmd, check=True)
    return out


# ── Core dispatch (shared by every entrypoint) ────────────────────────────────
def report_progress(job: dict[str, Any], pct: int | None = None, stage: str | None = None) -> None:
    """Best-effort real-progress callback to Aurora (task #284).

    Aurora includes `job_id` in the dispatch body for queue-backed jobs and
    exposes POST /api/public/workers/progress authenticated with the SAME
    AURORA_REGISTER_SECRET used for self-registration — no new secret to
    provision. Silently does nothing when job_id / AURORA_URL / secret are
    absent (e.g. a direct RunPod smoke test) and NEVER raises: progress is
    cosmetic, a render must not fail because a status ping did.
    """
    job_id = job.get("job_id")
    aurora_url = os.environ.get("AURORA_URL", "").strip().rstrip("/")
    register_key = os.environ.get("AURORA_REGISTER_SECRET", "").strip()
    if not (job_id and aurora_url and register_key):
        return
    body: dict[str, Any] = {"job_id": job_id}
    if pct is not None:
        body["pct"] = max(0, min(100, int(pct)))
    if stage:
        body["stage"] = str(stage)[:120]
    try:
        requests.post(
            f"{aurora_url}/api/public/workers/progress",
            json=body,
            headers={"apikey": register_key, "content-type": "application/json"},
            timeout=5,
        )
    except Exception:
        pass  # cosmetic — never let a progress ping break the job


def process_job(job: dict[str, Any]) -> dict[str, str]:
    kind = (job.get("kind") or "").lower()
    params = job.get("params") or {}
    image_urls = job.get("image_urls") or []

    report_progress(job, pct=5, stage="preparing inputs")
    if kind == "lipsync":
        face = job.get("video_url") or (image_urls[0] if image_urls else None)
        report_progress(job, pct=15, stage="running lip sync")
        out = run_latentsync(face, job.get("audio_url"), params)
    elif kind == "motion":
        ref = image_urls[0] if image_urls else None
        report_progress(job, pct=15, stage="running motion transfer")
        out = run_mimicmotion(ref, job.get("video_url"), params)
    elif kind == "assemble":
        report_progress(job, pct=15, stage="assembling video")
        out = run_assemble(params)
    elif kind == "lyric_video":
        report_progress(job, pct=15, stage="rendering lyric video")
        out = run_lyric_video(job.get("audio_url"), job.get("segments") or [], params)
    elif kind == "image":
        report_progress(job, pct=15, stage="rendering image")
        out = run_image(job.get("prompt") or "", params)
    else:
        raise ValueError(
            f"unsupported kind {kind!r}; this worker serves: lipsync, motion, assemble, lyric_video, image"
        )

    report_progress(job, pct=85, stage="uploading result")
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
    # installed. assemble/lyric_video need only ffmpeg; image needs diffusers.
    default = ["lipsync", "motion"]
    if shutil.which("ffmpeg"):
        default.append("assemble")
        # lyric_video additionally needs ffmpeg built with libass (the
        # `subtitles` filter); nearly all distro ffmpeg builds include it. A
        # worker without libass will simply fail that one job explicitly
        # rather than silently mis-advertise — same tolerance as `assemble`.
        default.append("lyric_video")
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

    Reads the stable Ngrok domain + Aurora URL + register secret from env and
    POSTs to `${AURORA_URL}/api/public/workers/register`. Auth is a private
    operator secret sent as the `apikey` header — deliberately NOT the Supabase
    anon/publishable key, since that key ships to every browser and would let
    anyone register a fake worker. The worker never needs a Supabase service key.

    Env:
      NGROK_STATIC_DOMAIN  your free Ngrok static domain, e.g. "foo-bar.ngrok-free.app"
      AURORA_URL           base URL of the Aurora app, e.g. "https://aurora.example.com"
      AURORA_REGISTER_SECRET  private operator secret (set as AURORA_REGISTER_SECRET
                           in Aurora too); NEVER the Supabase anon/publishable key.
      AURORA_WORKER_TOKEN  (optional) this worker's /generate bearer; sent as auth_token

    Never raises: a registration failure must not stop the worker from serving.
    Returns True on success, False otherwise.
    """
    domain = os.environ.get("NGROK_STATIC_DOMAIN", "").strip()
    aurora_url = os.environ.get("AURORA_URL", "").strip().rstrip("/")
    register_key = os.environ.get("AURORA_REGISTER_SECRET", "").strip()
    legacy_key = os.environ.get("AURORA_REGISTER_KEY", "").strip()
    if legacy_key:
        print("\n" + "!" * 80, flush=True)
        print("[register] WARNING: retired AURORA_REGISTER_KEY is still configured.", flush=True)
        print("[register] Rename it to AURORA_REGISTER_SECRET and replace it with a NEW", flush=True)
        print("[register] private operator secret. Do NOT reuse the Supabase anon/publishable", flush=True)
        print("[register] key or any old AURORA_REGISTER_KEY value.", flush=True)
        print("!" * 80 + "\n", flush=True)
    if not (domain and aurora_url and register_key):
        print(
            "[register] skipped — set NGROK_STATIC_DOMAIN, AURORA_URL and "
            "AURORA_REGISTER_SECRET to auto-register (worker still serves jobs).",
            flush=True,
        )
        return False

    # Print a one-way fingerprint of the key we're about to send — NEVER the
    # key itself. On a 401, Aurora's register endpoint logs the matching
    # "received fp:" / "expected fp:" pair in Admin -> Workers -> Recent
    # registration attempts; compare the two 8-char hex prefixes to instantly
    # tell "wrong secret pasted here" apart from "secret not set in Aurora yet"
    # without either side ever exposing the raw value.
    key_fp = hashlib.sha256(register_key.encode()).hexdigest()[:8]
    print(f"[register] using AURORA_REGISTER_SECRET fingerprint {key_fp} (compare against Admin -> Workers on a 401)", flush=True)

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
        body: dict = {}
        try:
            body = r.json()
        except Exception:
            pass
        reg_status = body.get("registration_status", "unknown")
        if reg_status == "pending_approval":
            print(
                f"[register] PENDING APPROVAL — {endpoint_url} registered but is awaiting "
                "admin approval at Admin → Workers → Pending before it can receive jobs.",
                flush=True,
            )
        else:
            print(f"[register] OK — {endpoint_url} registered with Aurora (status: {reg_status}).", flush=True)
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
