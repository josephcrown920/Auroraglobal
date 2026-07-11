# Aurora Video Generator — inference.sh App

Text-to-video and image-to-video with camera motion control, powered by [Wan2.1](https://huggingface.co/Wan-AI).

## Deploy

```bash
# Install the inference.sh CLI
pip install infsh

# Login
infsh login

# Deploy (from this directory)
infsh app deploy
```

Once deployed, copy the app ref (e.g. `your-namespace/aurora-video`) and set it in Aurora:

```
INFERENCE_SH_APP_VIDEO=your-namespace/aurora-video
```

## Input

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `prompt` | string | required | Scene / shot description |
| `image_urls` | string[] | `[]` | First URL = start frame → activates i2v mode |
| `camera_movement` | string | `"static"` | See presets below |
| `duration_seconds` | float | `5` | Clip length in seconds (1–10) |
| `fps` | int | `16` | Frames per second: 8 / 16 / 24 |
| `width` | int | `832` | Output width in pixels |
| `height` | int | `480` | Output height in pixels |
| `seed` | int | `-1` | `-1` = random |

## Camera Movement Presets

| Value | Description |
|-------|-------------|
| `static` | Locked tripod, no movement |
| `push_in` | Dolly push toward subject |
| `pull_out` | Dolly pull away from subject |
| `zoom_in` | Optical zoom in |
| `zoom_out` | Optical zoom out |
| `orbit_left` | Arc shot left → right |
| `orbit_right` | Arc shot right → left |
| `pan_left` | Horizontal pan left |
| `pan_right` | Horizontal pan right |
| `tilt_up` | Camera tilt upward |
| `tilt_down` | Camera tilt downward |

## Output

```json
{
  "video": { "uri": "https://..." }
}
```

This matches Aurora's `extractOutputUrl("uri")` key automatically.

## Models

| Mode | Default model | Override env var |
|------|--------------|-----------------|
| T2V | `Wan-AI/Wan2.1-T2V-1.3B` | `T2V_MODEL_ID` |
| I2V | `Wan-AI/Wan2.1-I2V-14B-480P` | `I2V_MODEL_ID` |

## Resources

- GPU: NVIDIA A100 (40 GB)
- VRAM: ~18 GB for I2V-14B with CPU offload
- Cold start: ~60 s (model download cached after first run)
- Warm inference: ~25–40 s per clip

## Local testing (without inference.sh)

```bash
pip install -r requirements.txt

python - <<'EOF'
import sys; sys.modules["infsh"] = type(sys)("infsh")
# Stub File so inference.py imports cleanly
class File:
    def __init__(self, path, content_type): self.path = path
sys.modules["infsh"].File = File

from inference import run
result = run({
    "prompt": "cinematic portrait of a woman in golden hour light",
    "camera_movement": "push_in",
    "duration_seconds": 3,
    "fps": 16,
})
print("Output written to:", result["video"].path)
EOF
```
