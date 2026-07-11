"""
Aurora Video Generator — inference.sh app
Supports text-to-video (t2v) and image-to-video (i2v) using Wan2.1,
with 10 camera-motion presets baked via prompt engineering + trajectory hints.

Input fields
------------
prompt          str   Required. Scene description.
image_urls      list  Optional. First URL used as the start frame (activates i2v).
camera_movement str   Optional. One of the CAMERA_PRESETS keys (default "static").
duration_seconds float Optional. Clip length in seconds 1–10 (default 5).
fps             int   Optional. 8 | 16 | 24 (default 16).
width           int   Optional. Output width  (default 832).
height          int   Optional. Output height (default 480).
seed            int   Optional. -1 = random (default -1).

Output
------
{"video": <File>}   — inference.sh File object; the platform exposes it as
                      {"video": {"uri": "https://..."}} in the task output,
                      matching Aurora's extractOutputUrl("uri") key.
"""

from __future__ import annotations

import os
import random
import tempfile
import uuid
from io import BytesIO
from typing import Any

import torch
from PIL import Image

try:
    import requests
except ImportError:
    requests = None  # type: ignore[assignment]

# ── Camera movement → prompt suffix + strength hint ──────────────────────────

CAMERA_PRESETS: dict[str, str] = {
    "static":       "camera locked on tripod, no camera movement",
    "push_in":      "smooth dolly push in toward the subject, slow and cinematic",
    "pull_out":     "smooth dolly pull out away from the subject, slow and cinematic",
    "zoom_in":      "subtle optical zoom in, lens compression, no physical movement",
    "zoom_out":     "subtle optical zoom out, revealing the environment",
    "orbit_left":   "camera orbiting the subject from left to right, arc shot",
    "orbit_right":  "camera orbiting the subject from right to left, arc shot",
    "pan_left":     "slow horizontal pan to the left, following the scene",
    "pan_right":    "slow horizontal pan to the right, following the scene",
    "tilt_up":      "slow camera tilt upward, revealing the sky or ceiling",
    "tilt_down":    "slow camera tilt downward, revealing the ground or floor",
}

DEFAULT_CAMERA = "static"

# ── Model IDs ─────────────────────────────────────────────────────────────────

T2V_MODEL_ID = os.environ.get("T2V_MODEL_ID", "Wan-AI/Wan2.1-T2V-1.3B")
I2V_MODEL_ID = os.environ.get("I2V_MODEL_ID", "Wan-AI/Wan2.1-I2V-14B-480P")

# ── Lazy-loaded pipelines (warm on first call, cached for subsequent) ─────────

_t2v_pipe = None
_i2v_pipe = None


def _load_t2v():
    global _t2v_pipe
    if _t2v_pipe is None:
        from diffusers import WanPipeline

        print(f"[aurora-video] Loading T2V model: {T2V_MODEL_ID}")
        _t2v_pipe = WanPipeline.from_pretrained(
            T2V_MODEL_ID,
            torch_dtype=torch.bfloat16,
        ).to("cuda")
        _t2v_pipe.enable_model_cpu_offload()
        print("[aurora-video] T2V model loaded.")
    return _t2v_pipe


def _load_i2v():
    global _i2v_pipe
    if _i2v_pipe is None:
        from diffusers import WanImageToVideoPipeline

        print(f"[aurora-video] Loading I2V model: {I2V_MODEL_ID}")
        _i2v_pipe = WanImageToVideoPipeline.from_pretrained(
            I2V_MODEL_ID,
            torch_dtype=torch.bfloat16,
        ).to("cuda")
        _i2v_pipe.enable_model_cpu_offload()
        print("[aurora-video] I2V model loaded.")
    return _i2v_pipe


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fetch_image(url: str) -> Image.Image:
    if requests is None:
        raise RuntimeError("requests is not installed")
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return Image.open(BytesIO(r.content)).convert("RGB")


def _build_prompt(prompt: str, camera: str) -> str:
    suffix = CAMERA_PRESETS.get(camera, CAMERA_PRESETS[DEFAULT_CAMERA])
    if suffix and suffix not in prompt:
        return f"{prompt.rstrip('.')}. {suffix}."
    return prompt


def _num_frames(duration_seconds: float, fps: int) -> int:
    """Convert duration + fps to a frame count Wan2.1 accepts (must be 4k+1)."""
    raw = max(1, round(duration_seconds * fps))
    # Wan2.1 requires num_frames = 4n + 1 (e.g. 17, 21, 25, …)
    remainder = (raw - 1) % 4
    if remainder != 0:
        raw = raw + (4 - remainder)
    return max(17, min(raw, 4 * fps * 10 + 1))  # cap at ~10 s


# ── Main entry point ──────────────────────────────────────────────────────────

def run(inputs: dict[str, Any]) -> dict[str, Any]:
    """Called by inference.sh for every /run request."""
    from infsh import File  # provided by inference.sh runtime

    prompt: str = inputs.get("prompt") or "cinematic scene, high quality"
    image_urls: list[str] = inputs.get("image_urls") or []
    camera: str = inputs.get("camera_movement") or DEFAULT_CAMERA
    duration: float = float(inputs.get("duration_seconds") or 5)
    fps: int = int(inputs.get("fps") or 16)
    width: int = int(inputs.get("width") or 832)
    height: int = int(inputs.get("height") or 480)
    seed_val: int = int(inputs.get("seed") or -1)

    if seed_val == -1:
        seed_val = random.randint(0, 2**31 - 1)
    generator = torch.Generator("cuda").manual_seed(seed_val)

    full_prompt = _build_prompt(prompt, camera)
    num_frames = _num_frames(duration, fps)

    print(
        f"[aurora-video] mode={'i2v' if image_urls else 't2v'} "
        f"camera={camera} frames={num_frames} fps={fps} "
        f"size={width}x{height} seed={seed_val}"
    )
    print(f"[aurora-video] prompt: {full_prompt[:120]}")

    out_path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4()}.mp4")

    if image_urls:
        # ── Image-to-video ────────────────────────────────────────────────────
        pipe = _load_i2v()
        image = _fetch_image(image_urls[0])
        image = image.resize((width, height), Image.LANCZOS)

        result = pipe(
            image=image,
            prompt=full_prompt,
            negative_prompt=(
                "low quality, worst quality, blurry, watermark, text, "
                "distorted face, static, no movement, frozen"
            ),
            num_frames=num_frames,
            guidance_scale=5.0,
            num_inference_steps=30,
            width=width,
            height=height,
            generator=generator,
        )
    else:
        # ── Text-to-video ─────────────────────────────────────────────────────
        pipe = _load_t2v()
        result = pipe(
            prompt=full_prompt,
            negative_prompt=(
                "low quality, worst quality, blurry, watermark, text, "
                "static, no movement, frozen"
            ),
            num_frames=num_frames,
            guidance_scale=6.0,
            num_inference_steps=30,
            width=width,
            height=height,
            generator=generator,
        )

    # Export frames → MP4
    from diffusers.utils import export_to_video

    export_to_video(result.frames[0], out_path, fps=fps)
    print(f"[aurora-video] wrote {out_path}")

    return {"video": File(path=out_path, content_type="video/mp4")}
