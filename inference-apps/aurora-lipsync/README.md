# Aurora Lip Sync — inference.sh App

Audio-driven lip synchronisation for video and portrait images, powered by
[LatentSync-1.5](https://huggingface.co/ByteDance/LatentSync-1.5) (ByteDance).

## Deploy

```bash
pip install infsh
infsh login
infsh app deploy   # run from this directory
```

Copy the app ref (e.g. `your-namespace/aurora-lipsync`) and set it in Aurora:

```
INFERENCE_SH_APP_LIPSYNC=your-namespace/aurora-lipsync
```

## Input

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `audio_url` | string | **required** | Public URL to the driving audio (WAV / MP3 / M4A) |
| `video_url` | string | — | Public URL to the source video (MP4). Takes priority over `image_url`. |
| `image_url` | string | — | Public URL to a portrait image (JPEG / PNG). Promoted to a looping video internally. |
| `image_urls` | string[] | — | Aurora compat alias — first entry used as `image_url`. |
| `mode` | string | `"video"` | `"video"` or `"image"` — inferred from which source URL is provided. |
| `inference_steps` | int | `25` | Diffusion steps 10–50. Higher = better quality, slower. |
| `guidance_scale` | float | `1.5` | Classifier-free guidance strength. |
| `seed` | int | `-1` | `-1` = random. |

## Output

```json
{ "video": { "uri": "https://..." } }
```

Matches Aurora's `extractOutputUrl("uri")` key automatically.

## Modes

**Video mode** (`video_url` provided):
- Source video lip region replaced with audio-driven animation.
- Background and body preserved via compositing.

**Image mode** (`image_url` provided):
- Still portrait promoted to a 5-second looping video (extended to match audio length).
- Full talking-head animation driven by the audio.

## Resources

- GPU: NVIDIA A100 (40 GB)
- VRAM: ~22 GB peak for LatentSync-1.5 with CPU offload
- Cold start: ~90 s (model download cached after first run)
- Warm inference: ~30–60 s per 5-second clip

## Local testing (without inference.sh)

```bash
pip install -r requirements.txt

python - <<'EOF'
import sys; sys.modules["infsh"] = type(sys)("infsh")
class File:
    def __init__(self, path, content_type): self.path = path
sys.modules["infsh"].File = File

from inference import run
result = run({
    "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Gatto_europeo4.jpg/256px-Gatto_europeo4.jpg",
    "inference_steps": 10,
})
print("Output written to:", result["video"].path)
EOF
```
