"""
Aurora Motion Studio — inference.sh app
========================================
Multi-task GPU worker: motion transfer · lip sync · text/image-to-video.

Task routing
------------
Pass ``task`` in the request params (or top-level input).  Default: "motion".

  motion   Identity-preserving motion transfer.
           Drive a reference portrait with a driving video's body motion.
           Primary backend: Champ (skeleton + depth + normal maps).
           Fallback: AnimateDiff + DWPose ControlNet.

  lipsync  Audio-driven lip sync (LatentSync-1.5).
           Same contract as the aurora-lipsync app.

  video    Fast text-to-video / image-to-video (AnimateDiff-Lightning).

Input fields (all tasks)
------------------------
task            str   "motion" | "lipsync" | "video"  (default "motion")
prompt          str   Style / content guidance (motion + video tasks)
video_url       str   Driving video URL  (motion = motion source; lipsync = source video)
image_url       str   Reference portrait URL  (motion = appearance; lipsync = face photo)
image_urls      list  First element used as image_url when image_url absent
audio_url       str   Driving audio URL  (lipsync only)

motion-specific params (passed inside params{} or at top level)
--------------------------------------------
num_frames      int   Output frame count  (default 16, max 64)
fps             int   Output FPS          (default 8)
width           int   Output width pixels (default 512)
height          int   Output height pixels(default 768)
guidance_scale  float CFG scale          (default 3.5)
inference_steps int   Diffusion steps    (default 20)
seed            int   -1 = random        (default -1)
use_champ       bool  Force Champ backend (default True; falls back on error)

lipsync-specific params
-----------------------
inference_steps int   Diffusion steps    (default 25)
guidance_scale  float CFG scale          (default 1.5)
seed            int   -1 = random        (default -1)

video-specific params
---------------------
num_frames      int   Frames to generate (default 16)
fps             int   Output FPS         (default 8)
guidance_scale  float CFG scale          (default 7.5)
inference_steps int   Diffusion steps    (default 4 for Lightning)
seed            int   -1 = random        (default -1)

Output
------
{"video": <infsh.File>}  — URI exposed by inference.sh task result.

Notes
-----
* First cold start downloads model weights to /workspace; ~120-180 s on A100.
* Models are cached persistently across requests on inference.sh.
* motion task: driving video must contain clear full-body or upper-body motion.
  Close-up talking-head videos work best with the lipsync task instead.
"""

from __future__ import annotations

import os
import random
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Any

import torch
import numpy as np

# ── Paths ──────────────────────────────────────────────────────────────────────
_CACHE = Path(os.environ.get("HF_HOME", "/workspace/.cache/huggingface"))
_CHAMP_ID = os.environ.get("CHAMP_MODEL_ID", "fudan-generative-vision/champ")
_LIPSYNC_ID = os.environ.get("LIPSYNC_MODEL_ID", "ByteDance/LatentSync-1.5")
_ADIFF_LIGHTNING_ID = os.environ.get("ANIMATEDIFF_LIGHTNING_ID", "ByteDance/AnimateDiff-Lightning")
_SDXL_BASE_ID = os.environ.get("SDXL_BASE_ID", "stabilityai/stable-diffusion-xl-base-1.0")
_ADIFF_ADAPTER_ID = os.environ.get("ANIMATEDIFF_MODEL_ID", "guoyww/animatediff-motion-adapter-sdxl-beta")

# ── Global model cache (warm across requests) ──────────────────────────────────
_champ_pipeline = None
_lipsync_pipeline = None
_video_pipeline = None
_pose_extractor = None


# ══════════════════════════════════════════════════════════════════════════════
# Utility helpers
# ══════════════════════════════════════════════════════════════════════════════

import requests as _req


def _download(url: str, suffix: str) -> str:
    r = _req.get(url, timeout=120, stream=True)
    r.raise_for_status()
    fd, path = tempfile.mkstemp(suffix=suffix)
    with os.fdopen(fd, "wb") as f:
        for chunk in r.iter_content(chunk_size=65536):
            f.write(chunk)
    return path


def _read_video_frames(video_path: str, max_frames: int = 64) -> list[np.ndarray]:
    """Read video frames as numpy arrays (H×W×3 uint8 RGB)."""
    import cv2
    cap = cv2.VideoCapture(video_path)
    frames = []
    while len(frames) < max_frames:
        ok, frame = cap.read()
        if not ok:
            break
        frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    cap.release()
    return frames


def _get_video_fps(video_path: str) -> float:
    import cv2
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    cap.release()
    return fps


def _write_video(frames: list[np.ndarray], output_path: str, fps: int = 8) -> None:
    """Write RGB frames list to an mp4 file via imageio."""
    import imageio
    imageio.mimwrite(output_path, frames, fps=fps, codec="libx264",
                     quality=8, macro_block_size=8)


def _image_to_video_ffmpeg(image_path: str, duration_s: float, fps: int = 25) -> str:
    """Promote a still image to a looping video."""
    out = f"/tmp/{uuid.uuid4()}.mp4"
    subprocess.run([
        "ffmpeg", "-y", "-loop", "1", "-i", image_path,
        "-t", str(duration_s),
        "-vf", f"fps={fps},scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-c:v", "libx264", "-preset", "fast", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", out,
    ], check=True, capture_output=True)
    return out


def _get_audio_duration(audio_path: str) -> float:
    r = subprocess.run([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", audio_path,
    ], capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def _seed(val: int) -> int:
    return val if val >= 0 else random.randint(0, 2**31 - 1)


# ══════════════════════════════════════════════════════════════════════════════
# Task: MOTION TRANSFER
# ══════════════════════════════════════════════════════════════════════════════

def _load_pose_extractor():
    global _pose_extractor
    if _pose_extractor is not None:
        return _pose_extractor
    from controlnet_aux import DWposeDetector
    _pose_extractor = DWposeDetector()
    print("[motion] DWPose extractor loaded.")
    return _pose_extractor


def _extract_pose_frames(video_path: str, target_size: tuple[int, int],
                          max_frames: int) -> list:
    """Extract DWPose skeleton maps from video frames."""
    from PIL import Image
    pose_extractor = _load_pose_extractor()
    raw_frames = _read_video_frames(video_path, max_frames=max_frames)
    pose_frames = []
    for frame in raw_frames:
        pil = Image.fromarray(frame).resize(target_size, Image.LANCZOS)
        posed = pose_extractor(pil, detect_resolution=target_size[0],
                               image_resolution=target_size[0])
        pose_frames.append(posed)
    return pose_frames


def _load_champ_pipeline():
    global _champ_pipeline
    if _champ_pipeline is not None:
        return _champ_pipeline

    from huggingface_hub import snapshot_download
    print(f"[motion] Downloading Champ weights: {_CHAMP_ID}")
    model_dir = snapshot_download(_CHAMP_ID, local_dir=str(_CACHE / "champ"),
                                  ignore_patterns=["*.gguf"])
    print(f"[motion] Champ cached at {model_dir}")

    try:
        from champ.models.champ_model import ChampModel  # type: ignore[import]
        from champ.pipelines.pipeline_champ import ChampPipeline  # type: ignore[import]
        from omegaconf import OmegaConf

        cfg_path = os.path.join(model_dir, "configs", "inference.yaml")
        if not os.path.exists(cfg_path):
            raise FileNotFoundError(f"config not found: {cfg_path}")

        cfg = OmegaConf.load(cfg_path)
        champ = ChampModel(cfg=cfg.model, model_dir=model_dir)
        pipe = ChampPipeline(champ_model=champ, device="cuda",
                             dtype=torch.float16)
        _champ_pipeline = {"pipe": pipe, "cfg": cfg, "model_dir": model_dir,
                           "mode": "native"}
        print("[motion] Champ pipeline loaded (native).")
    except (ImportError, FileNotFoundError, Exception) as exc:
        print(f"[motion] Champ native load failed ({exc}); will use AnimateDiff fallback.")
        _champ_pipeline = {"model_dir": model_dir, "mode": "fallback"}

    return _champ_pipeline


def _motion_via_champ(champ: dict, reference_image_path: str,
                      driving_video_path: str, num_frames: int,
                      width: int, height: int, guidance_scale: float,
                      inference_steps: int, seed_val: int,
                      output_path: str) -> None:
    """Run Champ identity-preserving motion transfer."""
    from PIL import Image
    pipe = champ["pipe"]

    ref_image = Image.open(reference_image_path).convert("RGB").resize(
        (width, height), Image.LANCZOS)

    pose_frames = _extract_pose_frames(
        driving_video_path, (width, height), max_frames=num_frames)
    if not pose_frames:
        raise RuntimeError("Could not extract pose frames from driving video")

    generator = torch.Generator("cuda").manual_seed(seed_val)
    result = pipe(
        reference_image=ref_image,
        motion_signals=pose_frames,
        width=width,
        height=height,
        num_frames=num_frames,
        guidance_scale=guidance_scale,
        num_inference_steps=inference_steps,
        generator=generator,
    )

    # Export result frames to video
    if hasattr(result, "frames"):
        out_frames = [np.array(f) for f in (result.frames[0]
                                             if isinstance(result.frames[0], list)
                                             else result.frames)]
        _write_video(out_frames, output_path, fps=8)
    elif isinstance(result, str):
        subprocess.run(["ffmpeg", "-y", "-i", result,
                        "-movflags", "+faststart", output_path],
                       check=True, capture_output=True)
    else:
        raise RuntimeError(f"Unexpected Champ output: {type(result)}")


def _motion_via_animatediff_controlnet(reference_image_path: str,
                                        driving_video_path: str,
                                        prompt: str, num_frames: int,
                                        width: int, height: int,
                                        guidance_scale: float,
                                        inference_steps: int,
                                        seed_val: int,
                                        output_path: str) -> None:
    """Fallback: AnimateDiff + DWPose ControlNet for motion-guided generation."""
    from diffusers import (AnimateDiffControlNetPipeline,
                            ControlNetModel, MotionAdapter,
                            DDIMScheduler)
    from diffusers.utils import export_to_video
    from PIL import Image

    print("[motion] Loading AnimateDiff + ControlNet fallback…")
    controlnet = ControlNetModel.from_pretrained(
        "lllyasviel/control_v11p_sd15_openpose",
        torch_dtype=torch.float16).to("cuda")
    adapter = MotionAdapter.from_pretrained(
        "guoyww/animatediff-motion-adapter-v1-5-2",
        torch_dtype=torch.float16)

    from diffusers import StableDiffusionPipeline  # used as base
    pipe = AnimateDiffControlNetPipeline.from_pretrained(
        "runwayml/stable-diffusion-v1-5",
        controlnet=controlnet,
        motion_adapter=adapter,
        torch_dtype=torch.float16,
    ).to("cuda")
    pipe.scheduler = DDIMScheduler.from_config(pipe.scheduler.config,
                                               beta_schedule="linear",
                                               clip_sample=False,
                                               timestep_spacing="linspace",
                                               steps_offset=1)
    pipe.enable_vae_slicing()
    pipe.enable_xformers_memory_efficient_attention()

    pose_frames = _extract_pose_frames(
        driving_video_path, (width, height), max_frames=num_frames)

    ref_img = Image.open(reference_image_path).convert("RGB").resize(
        (width, height), Image.LANCZOS)
    ref_prompt = prompt or "a person, high quality, detailed, cinematic"

    generator = torch.Generator("cuda").manual_seed(seed_val)
    result = pipe(
        prompt=ref_prompt,
        image=ref_img,
        conditioning_frames=pose_frames,
        num_frames=len(pose_frames),
        guidance_scale=guidance_scale,
        num_inference_steps=inference_steps,
        generator=generator,
    )
    export_to_video(result.frames[0], output_path, fps=8)


def run_motion(inputs: dict[str, Any]) -> str:
    """Motion transfer — returns output video path."""
    params = inputs.get("params") or {}
    # Accept params both at top-level and inside params{}
    def p(key, default):
        return params.get(key, inputs.get(key, default))

    reference_url: str | None = (
        inputs.get("image_url")
        or (inputs.get("image_urls") or [None])[0]
    )
    driving_url: str | None = (
        inputs.get("video_url") or inputs.get("media_url")
    )
    prompt: str = p("prompt", "a person performing motion, high quality, cinematic")
    num_frames: int = int(p("num_frames", 16))
    fps: int = int(p("fps", 8))
    width: int = int(p("width", 512))
    height: int = int(p("height", 768))
    guidance_scale: float = float(p("guidance_scale", 3.5))
    inference_steps: int = int(p("inference_steps", 20))
    seed_val: int = _seed(int(p("seed", -1)))
    use_champ: bool = str(p("use_champ", "true")).lower() != "false"

    if not reference_url:
        raise ValueError("image_url (reference portrait) is required for motion transfer")
    if not driving_url:
        raise ValueError("video_url (driving video) is required for motion transfer")

    num_frames = min(num_frames, 64)
    print(f"[motion] frames={num_frames} size={width}×{height} steps={inference_steps} "
          f"guidance={guidance_scale} seed={seed_val} champ={use_champ}")

    ref_path = _download(reference_url, ".jpg")
    drv_path = _download(driving_url, ".mp4")
    out_path = f"/tmp/{uuid.uuid4()}.mp4"

    if use_champ:
        champ = _load_champ_pipeline()
        if champ["mode"] == "native":
            try:
                print("[motion] Running Champ…")
                _motion_via_champ(champ, ref_path, drv_path, num_frames,
                                  width, height, guidance_scale,
                                  inference_steps, seed_val, out_path)
                print(f"[motion] Champ done → {out_path}")
                return out_path
            except Exception as exc:
                print(f"[motion] Champ failed ({exc}), falling back to AnimateDiff")

    # AnimateDiff fallback
    print("[motion] Running AnimateDiff + ControlNet…")
    _motion_via_animatediff_controlnet(
        ref_path, drv_path, prompt, num_frames, width, height,
        guidance_scale, inference_steps, seed_val, out_path)
    print(f"[motion] AnimateDiff done → {out_path}")

    # Ensure faststart (mobile-safe) and requested FPS
    final_path = f"/tmp/{uuid.uuid4()}.mp4"
    subprocess.run([
        "ffmpeg", "-y", "-i", out_path,
        "-vf", f"fps={fps}",
        "-movflags", "+faststart",
        "-pix_fmt", "yuv420p", final_path,
    ], check=True, capture_output=True)
    return final_path


# ══════════════════════════════════════════════════════════════════════════════
# Task: LIP SYNC (LatentSync-1.5)
# ══════════════════════════════════════════════════════════════════════════════

def _load_lipsync_pipeline():
    global _lipsync_pipeline
    if _lipsync_pipeline is not None:
        return _lipsync_pipeline

    from huggingface_hub import snapshot_download
    print(f"[lipsync] Downloading LatentSync weights: {_LIPSYNC_ID}")
    model_dir = snapshot_download(_LIPSYNC_ID, local_dir=str(_CACHE / "latentsync"),
                                  ignore_patterns=["*.gguf"])
    print(f"[lipsync] Cached at {model_dir}")
    try:
        from latentsync.pipelines.lipsync_pipeline import LatentSyncPipeline  # type: ignore[import]
        pipe = LatentSyncPipeline.from_pretrained(
            model_dir, torch_dtype=torch.float16).to("cuda")
        pipe.enable_model_cpu_offload()
        _lipsync_pipeline = {"pipe": pipe, "mode": "native"}
        print("[lipsync] Pipeline loaded (native).")
    except (ImportError, AttributeError):
        _lipsync_pipeline = {"model_dir": model_dir, "mode": "subprocess"}
        print("[lipsync] Pipeline loaded (subprocess mode).")
    return _lipsync_pipeline


def _lipsync_subprocess(model_dir: str, video_path: str, audio_path: str,
                         steps: int, scale: float, seed_val: int,
                         output_path: str) -> None:
    import latentsync  # type: ignore[import]
    ckpts = list(Path(model_dir).rglob("latentsync_unet.pt"))
    ckpt = str(ckpts[0]) if ckpts else os.path.join(model_dir, "checkpoints", "latentsync_unet.pt")
    cfg = os.path.join(model_dir, "configs", "unet", "second_stage.yaml")
    script = os.path.join(os.path.dirname(latentsync.__file__), "..", "scripts", "inference.py")
    subprocess.run([
        "python", script,
        "--unet_config_path", cfg,
        "--inference_ckpt_path", ckpt,
        "--video_path", video_path,
        "--audio_path", audio_path,
        "--output_path", output_path,
        "--inference_steps", str(steps),
        "--guidance_scale", str(scale),
        "--seed", str(seed_val),
    ], check=True)


def run_lipsync(inputs: dict[str, Any]) -> str:
    """Lip sync — returns output video path."""
    params = inputs.get("params") or {}
    def p(key, default):
        return params.get(key, inputs.get(key, default))

    audio_url: str | None = inputs.get("audio_url")
    video_url: str | None = inputs.get("video_url") or inputs.get("media_url")
    image_url: str | None = inputs.get("image_url") or (
        (inputs.get("image_urls") or [None])[0])
    mode = "video" if video_url else "image"
    steps = int(p("inference_steps", 25))
    scale = float(p("guidance_scale", 1.5))
    seed_val = _seed(int(p("seed", -1)))

    if not audio_url:
        raise ValueError("audio_url is required for lipsync")
    if not (video_url or image_url):
        raise ValueError("Provide video_url or image_url for lipsync")

    print(f"[lipsync] mode={mode} steps={steps} guidance={scale} seed={seed_val}")
    audio_path = _download(audio_url, ".wav")
    source_path = _download(video_url or image_url, ".mp4" if video_url else ".jpg")  # type: ignore[arg-type]

    if mode == "image":
        try:
            audio_dur = _get_audio_duration(audio_path)
        except Exception:
            audio_dur = 5.0
        source_path = _image_to_video_ffmpeg(source_path, duration_s=max(3.0, audio_dur + 0.5))
        print(f"[lipsync] promoted image to {audio_dur:.1f}s video")

    out_path = f"/tmp/{uuid.uuid4()}.mp4"
    pipeline = _load_lipsync_pipeline()

    if pipeline["mode"] == "native":
        generator = torch.Generator("cuda").manual_seed(seed_val)
        result = pipeline["pipe"](
            video=source_path, audio=audio_path,
            num_inference_steps=steps, guidance_scale=scale,
            generator=generator,
        )
        if hasattr(result, "frames"):
            from diffusers.utils import export_to_video
            export_to_video(result.frames[0], out_path, fps=25)
        elif isinstance(result, str):
            os.rename(result, out_path)
    else:
        _lipsync_subprocess(pipeline["model_dir"], source_path, audio_path,
                             steps, scale, seed_val, out_path)

    print(f"[lipsync] done → {out_path}")
    return out_path


# ══════════════════════════════════════════════════════════════════════════════
# Task: VIDEO GENERATION (AnimateDiff-Lightning)
# ══════════════════════════════════════════════════════════════════════════════

def _load_video_pipeline():
    global _video_pipeline
    if _video_pipeline is not None:
        return _video_pipeline

    from diffusers import AnimateDiffPipeline, MotionAdapter, EulerDiscreteScheduler
    from huggingface_hub import hf_hub_download

    print("[video] Loading AnimateDiff-Lightning…")
    # 4-step LCM — fastest quality tradeoff
    ckpt = "animatediff_lightning_4step_diffusers.safetensors"
    adapter = MotionAdapter.from_pretrained(
        _ADIFF_LIGHTNING_ID, torch_dtype=torch.float16)
    pipe = AnimateDiffPipeline.from_pretrained(
        "emilianJR/epiCRealism",  # photorealistic SD1.5 base
        motion_adapter=adapter,
        torch_dtype=torch.float16,
    ).to("cuda")
    pipe.scheduler = EulerDiscreteScheduler.from_config(
        pipe.scheduler.config, timestep_spacing="trailing", beta_schedule="linear")
    pipe.enable_vae_slicing()
    try:
        pipe.enable_xformers_memory_efficient_attention()
    except Exception:
        pass

    _video_pipeline = pipe
    print("[video] AnimateDiff-Lightning loaded.")
    return _video_pipeline


def run_video(inputs: dict[str, Any]) -> str:
    """Text/image-to-video — returns output video path."""
    params = inputs.get("params") or {}
    def p(key, default):
        return params.get(key, inputs.get(key, default))

    prompt: str = p("prompt", "cinematic video, high quality, motion")
    negative_prompt: str = p("negative_prompt",
        "low quality, blurry, static, watermark, text, distorted")
    num_frames: int = min(int(p("num_frames", 16)), 32)
    fps: int = int(p("fps", 8))
    guidance_scale: float = float(p("guidance_scale", 1.0))
    inference_steps: int = int(p("inference_steps", 4))
    seed_val: int = _seed(int(p("seed", -1)))
    image_url: str | None = inputs.get("image_url") or (
        (inputs.get("image_urls") or [None])[0])

    print(f"[video] prompt={prompt[:80]} frames={num_frames} steps={inference_steps} seed={seed_val}")
    pipe = _load_video_pipeline()
    generator = torch.Generator("cuda").manual_seed(seed_val)

    call_kwargs: dict[str, Any] = dict(
        prompt=prompt,
        negative_prompt=negative_prompt,
        num_frames=num_frames,
        guidance_scale=guidance_scale,
        num_inference_steps=inference_steps,
        generator=generator,
    )
    if image_url:
        from PIL import Image
        img_path = _download(image_url, ".jpg")
        call_kwargs["image"] = Image.open(img_path).convert("RGB")

    result = pipe(**call_kwargs)

    out_path = f"/tmp/{uuid.uuid4()}.mp4"
    from diffusers.utils import export_to_video
    export_to_video(result.frames[0], out_path, fps=fps)

    # faststart for browser/mobile playback
    final_path = f"/tmp/{uuid.uuid4()}.mp4"
    subprocess.run([
        "ffmpeg", "-y", "-i", out_path, "-movflags", "+faststart",
        "-pix_fmt", "yuv420p", final_path,
    ], check=True, capture_output=True)
    print(f"[video] done → {final_path}")
    return final_path


# ══════════════════════════════════════════════════════════════════════════════
# inference.sh entry point
# ══════════════════════════════════════════════════════════════════════════════

def run(inputs: dict[str, Any]) -> dict[str, Any]:
    """Called by the inference.sh runtime for every /run request."""
    from infsh import File  # provided by the inference.sh runtime  # noqa: F401

    # Task is top-level or inside params{}
    params = inputs.get("params") or {}
    task: str = (
        inputs.get("task")
        or params.get("task")
        or "motion"
    ).lower()

    print(f"[aurora-motion-studio] task={task}")

    if task == "lipsync":
        video_path = run_lipsync(inputs)
    elif task == "video":
        video_path = run_video(inputs)
    else:
        # Default to motion transfer
        video_path = run_motion(inputs)

    return {"video": File(path=video_path, content_type="video/mp4")}
