# Aurora Motion Studio

Multi-task inference.sh GPU worker — **motion transfer**, **lip sync**, **video generation**.

Deploy to inference.sh, then set `INFERENCE_SH_APP_MOTION` (and optionally `INFERENCE_SH_APP_LIPSYNC`, `INFERENCE_SH_APP_VIDEO`) in Aurora's secrets to point at this app.

---

## Tasks

### `motion` — Identity-preserving motion transfer _(default)_

Transfer the body motion from a driving video onto a reference portrait, keeping the appearance of the person in the photo.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `image_url` / `image_urls[0]` | URL | ✅ | Reference portrait (appearance source) |
| `video_url` | URL | ✅ | Driving video (motion source) |
| `prompt` | string | — | Style guidance (default: "a person performing motion, high quality") |
| `num_frames` | int | — | Frames to generate, max 64 (default 16) |
| `fps` | int | — | Output FPS (default 8) |
| `width` / `height` | int | — | Output dimensions in px (default 512×768) |
| `guidance_scale` | float | — | CFG scale (default 3.5) |
| `inference_steps` | int | — | Diffusion steps (default 20) |
| `seed` | int | — | -1 = random |
| `use_champ` | bool | — | Force Champ; "false" skips straight to AnimateDiff fallback |

**Backend selection:**
1. **Champ** (`fudan-generative-vision/champ`) — skeleton + depth + normal maps → best for full-body human motion
2. **AnimateDiff + DWPose ControlNet** — fallback when Champ fails or the reference is non-human

---

### `lipsync` — Audio-driven lip sync

Sync lip movements in a video or portrait image to a driving audio track (LatentSync-1.5).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `audio_url` | URL | ✅ | WAV / MP3 / M4A |
| `video_url` | URL | — | Source video (takes priority over image) |
| `image_url` | URL | — | Portrait photo (promoted to 5-s loop) |
| `inference_steps` | int | — | Default 25 |
| `guidance_scale` | float | — | Default 1.5 |
| `seed` | int | — | -1 = random |

---

### `video` — Fast text/image-to-video

AnimateDiff-Lightning (4-step LCM, SDXL) — generates short clips from a prompt, optionally conditioned on an image.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `prompt` | string | ✅ | Content description |
| `image_url` | URL | — | Conditioning image (img→video) |
| `num_frames` | int | — | Max 32 (default 16) |
| `fps` | int | — | Default 8 |
| `guidance_scale` | float | — | Default 1.0 (Lightning uses low CFG) |
| `inference_steps` | int | — | Default 4 (Lightning) |
| `seed` | int | — | -1 = random |

---

## Wiring into Aurora

```
# Secrets / env vars to set in Aurora (Replit secrets panel)
INFERENCE_SH_API_KEY=inf_...
INFERENCE_SH_APP_MOTION=your-namespace/aurora-motion-studio
INFERENCE_SH_APP_LIPSYNC=your-namespace/aurora-motion-studio
INFERENCE_SH_APP_VIDEO=your-namespace/aurora-motion-studio
```

Setting all three to the same app ref lets a single A100 worker handle all three task types, avoiding cold-start penalties across different workers.

---

## Cold-start model downloads (first run)

| Model | Size | Purpose |
|-------|------|---------|
| `fudan-generative-vision/champ` | ~15 GB | Motion transfer (primary) |
| `ByteDance/LatentSync-1.5` | ~8 GB | Lip sync |
| `ByteDance/AnimateDiff-Lightning` | ~6 GB | Video gen |
| `emilianJR/epiCRealism` | ~4 GB | SD1.5 base for video |
| `lllyasviel/control_v11p_sd15_openpose` | ~1.4 GB | ControlNet (fallback) |
| `guoyww/animatediff-motion-adapter-v1-5-2` | ~800 MB | Motion adapter (fallback) |

Total first-run download: ~35 GB. Cached persistently at `/workspace/.cache`.  
Warm subsequent requests skip all downloads.

---

## GPU requirements

- **Minimum**: A100 40 GB (Champ uses ~30 GB at fp16 during inference)
- **Recommended**: A100 80 GB for larger frame counts or higher resolution
- The AnimateDiff-Lightning fallback (video + motion fallback) runs on an A10G (24 GB) if you remove Champ from the pipeline

## Output

All tasks return `{"video": <File>}`.  
inference.sh exposes this as `{"video": {"uri": "https://..."}}` in the task result JSON, which Aurora's `extractOutputUrl()` resolves via the `"uri"` key.
