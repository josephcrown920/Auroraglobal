"""
Aurora Lip Sync — inference.sh app
Synchronises lip movements in a video (or still image) to a driving audio track
using LatentSync-1.5 (ByteDance).

Input fields
------------
audio_url       str   Required. Public URL to the driving audio (WAV/MP3/M4A).
video_url       str   Optional. Public URL to the source video.  Mutually
                       exclusive with image_url; video_url takes priority.
image_url       str   Optional. Public URL to a still portrait image.
                       Aurora also accepts the first entry of image_urls[].
mode            str   Optional. "video" | "image" (default: inferred from input).
inference_steps int   Optional. Diffusion steps 10–50 (default 25 — good tradeoff).
guidance_scale  float Optional. Classifier-free guidance (default 1.5).
seed            int   Optional. -1 = random (default -1).

Output
------
{"video": <File>}   — inference.sh File; the platform exposes it as
                      {"video": {"uri": "https://..."}} in the task output,
                      matching Aurora's extractOutputUrl("uri") key.

Notes
-----
• The model runs on an A100 40 GB.  Cold start (~90 s first run) downloads
  LatentSync-1.5 weights from HuggingFace and caches them under /workspace.
• Still-image input ("image" mode) is promoted to a 5-second looping video
  before inference so LatentSync always sees a video stream.
• Audio longer than the source video is trimmed to match; shorter audio pads
  the video output to the audio length.
"""

from __future__ import annotations

import os
import random
import subprocess
import tempfile
import uuid
from io import BytesIO
from pathlib import Path
from typing import Any

import torch

try:
    import requests as _req
except ImportError:
    _req = None  # type: ignore[assignment]

# ── Paths ─────────────────────────────────────────────────────────────────────

_CACHE_DIR = Path(os.environ.get("HF_HOME", "/workspace/.cache/huggingface"))
_MODEL_ID = os.environ.get("LIPSYNC_MODEL_ID", "ByteDance/LatentSync-1.5")

# ── Lazy pipeline ─────────────────────────────────────────────────────────────

_pipeline = None


def _load_pipeline():
    global _pipeline
    if _pipeline is not None:
        return _pipeline

    from huggingface_hub import snapshot_download

    print(f"[aurora-lipsync] Downloading model weights: {_MODEL_ID}")
    model_dir = snapshot_download(
        _MODEL_ID,
        local_dir=str(_CACHE_DIR / "latentsync"),
        ignore_patterns=["*.gguf"],
    )
    print(f"[aurora-lipsync] Model cached at {model_dir}")

    # LatentSync exposes a pipeline class; fall back to subprocess if the
    # installed package doesn't expose one (version-dependent).
    try:
        from latentsync.pipelines.lipsync_pipeline import LatentSyncPipeline  # type: ignore[import]

        _pipeline = LatentSyncPipeline.from_pretrained(
            model_dir,
            torch_dtype=torch.float16,
        ).to("cuda")
        _pipeline.enable_model_cpu_offload()
        print("[aurora-lipsync] Pipeline loaded (native).")
    except (ImportError, AttributeError):
        # Fall back: store model_dir and use subprocess-based inference.
        _pipeline = {"model_dir": model_dir, "mode": "subprocess"}
        print("[aurora-lipsync] Pipeline loaded (subprocess mode).")

    return _pipeline


# ── Helpers ───────────────────────────────────────────────────────────────────


def _download(url: str, suffix: str) -> str:
    if _req is None:
        raise RuntimeError("requests is not installed")
    r = _req.get(url, timeout=60, stream=True)
    r.raise_for_status()
    fd, path = tempfile.mkstemp(suffix=suffix)
    with os.fdopen(fd, "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)
    return path


def _image_to_video(image_path: str, duration_s: float = 5.0, fps: int = 25) -> str:
    """Promote a still portrait image to a looping video for LatentSync."""
    out_path = f"/tmp/{uuid.uuid4()}.mp4"
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-loop", "1",
            "-i", image_path,
            "-t", str(duration_s),
            "-vf", f"fps={fps},scale=trunc(iw/2)*2:trunc(ih/2)*2",
            "-c:v", "libx264",
            "-preset", "fast",
            "-pix_fmt", "yuv420p",
            out_path,
        ],
        check=True,
        capture_output=True,
    )
    return out_path


def _get_audio_duration(audio_path: str) -> float:
    """Return audio duration in seconds via ffprobe."""
    result = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            audio_path,
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return float(result.stdout.strip())


def _run_native(pipeline, video_path: str, audio_path: str,
                inference_steps: int, guidance_scale: float,
                seed: int, output_path: str) -> None:
    """Run LatentSync via its Python pipeline."""
    generator = torch.Generator("cuda").manual_seed(seed)
    result = pipeline(
        video=video_path,
        audio=audio_path,
        num_inference_steps=inference_steps,
        guidance_scale=guidance_scale,
        generator=generator,
    )
    # Result may be a file path or a frames list depending on version.
    if hasattr(result, "frames"):
        from diffusers.utils import export_to_video
        export_to_video(result.frames[0], output_path, fps=25)
    elif isinstance(result, str):
        os.rename(result, output_path)
    else:
        raise RuntimeError(f"Unexpected pipeline output type: {type(result)}")


def _run_subprocess(model_dir: str, video_path: str, audio_path: str,
                    inference_steps: int, guidance_scale: float,
                    seed: int, output_path: str) -> None:
    """Run LatentSync via its bundled CLI inference script."""
    config_path = os.path.join(model_dir, "configs", "unet", "second_stage.yaml")
    ckpt_path = os.path.join(model_dir, "checkpoints", "latentsync_unet.pt")

    if not os.path.exists(ckpt_path):
        # Newer repo layout: weights are in the model root.
        ckpt_candidates = list(Path(model_dir).rglob("*.pt")) + list(Path(model_dir).rglob("*.safetensors"))
        ckpt_path = str(ckpt_candidates[0]) if ckpt_candidates else ckpt_path

    script = os.path.join(model_dir, "scripts", "inference.py")
    if not os.path.exists(script):
        # Try installed package path.
        import latentsync  # type: ignore[import]
        script = os.path.join(os.path.dirname(latentsync.__file__), "..", "scripts", "inference.py")

    subprocess.run(
        [
            "python", script,
            "--unet_config_path", config_path,
            "--inference_ckpt_path", ckpt_path,
            "--video_path", video_path,
            "--audio_path", audio_path,
            "--output_path", output_path,
            "--inference_steps", str(inference_steps),
            "--guidance_scale", str(guidance_scale),
            "--seed", str(seed),
        ],
        check=True,
    )


# ── Main entry point ───────────────────────────────────────────────────────────


def run(inputs: dict[str, Any]) -> dict[str, Any]:
    """Called by inference.sh for every /run request."""
    from infsh import File  # provided by the inference.sh runtime

    audio_url: str | None = inputs.get("audio_url")
    # Aurora's inferenceShInput maps both videoUrl→video_url and mediaUrl→media_url;
    # accept both as the source media, with video_url taking priority.
    video_url: str | None = inputs.get("video_url") or inputs.get("media_url")
    # Accept image_url or image_urls[0] (matches Aurora's orchestrator convention).
    image_url: str | None = inputs.get("image_url") or (
        (inputs.get("image_urls") or [None])[0]
    )
    mode: str = inputs.get("mode", "video" if video_url else "image")
    inference_steps: int = int(inputs.get("inference_steps") or 25)
    guidance_scale: float = float(inputs.get("guidance_scale") or 1.5)
    seed_val: int = int(inputs.get("seed") or -1)

    if not audio_url:
        raise ValueError("audio_url is required")
    source_url = video_url or image_url
    if not source_url:
        raise ValueError("Provide video_url or image_url")

    if seed_val == -1:
        seed_val = random.randint(0, 2**31 - 1)

    print(
        f"[aurora-lipsync] mode={mode} steps={inference_steps} "
        f"guidance={guidance_scale} seed={seed_val}"
    )

    # ── Download inputs ────────────────────────────────────────────────────────
    audio_path = _download(audio_url, ".wav")
    source_ext = ".mp4" if (mode == "video" and video_url) else ".jpg"
    source_path = _download(source_url, source_ext)

    # Promote still image to video if needed.
    if mode == "image" or (not video_url and image_url):
        try:
            audio_dur = _get_audio_duration(audio_path)
        except Exception:
            audio_dur = 5.0
        video_path = _image_to_video(source_path, duration_s=max(3.0, audio_dur + 0.5))
        print(f"[aurora-lipsync] promoted image to {audio_dur:.1f}s video")
    else:
        video_path = source_path

    output_path = f"/tmp/{uuid.uuid4()}.mp4"

    # ── Load model and run ─────────────────────────────────────────────────────
    pipeline = _load_pipeline()

    if isinstance(pipeline, dict) and pipeline.get("mode") == "subprocess":
        print("[aurora-lipsync] Running via subprocess…")
        _run_subprocess(
            pipeline["model_dir"], video_path, audio_path,
            inference_steps, guidance_scale, seed_val, output_path,
        )
    else:
        print("[aurora-lipsync] Running via native pipeline…")
        _run_native(
            pipeline, video_path, audio_path,
            inference_steps, guidance_scale, seed_val, output_path,
        )

    print(f"[aurora-lipsync] wrote {output_path}")
    return {"video": File(path=output_path, content_type="video/mp4")}
