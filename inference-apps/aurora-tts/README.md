# Aurora TTS — inference.sh App

Text-to-speech using [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M).
Fast, high-quality, multilingual (English, French, Japanese, Korean, Chinese, Spanish,
German, Italian, Portuguese, Hindi, Arabic).

## Deploy

```bash
pip install infsh
infsh login
infsh app deploy   # run from this directory
```

Copy the app ref (e.g. `your-namespace/aurora-tts`) and set it in Aurora:

```
INFERENCE_SH_APP_TTS=your-namespace/aurora-tts
```

## Input

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `text` | string | **required** | Text to synthesise (max 5 000 characters) |
| `voice` | string | `af_sky` | Voice name — see table below |
| `speed` | float | `1.0` | Speaking rate multiplier (0.5–2.0) |
| `lang` | string | auto | Language code override — inferred from `voice` if omitted |
| `split_pattern` | string | auto | Regex for sentence splitting |

### Voices

| Voice | Lang | Style |
|-------|------|-------|
| `af_sky` | en-us | Female, warm |
| `af_sarah` | en-us | Female, clear |
| `am_adam` | en-us | Male, deep |
| `af_nicole` | en-us | Female, expressive |
| `bf_emma` | en-gb | Female, British |
| `bm_george` | en-gb | Male, British |
| `ff_siwis` | fr-fr | Female, French |
| `jf_alpha` | ja | Female, Japanese |
| `kf_alpha` | ko | Female, Korean |
| `zf_xiaobei` | cmn | Female, Mandarin |
| `ef_dora` | es | Female, Spanish |
| `df_hedda` | de | Female, German |

## Output

```json
{ "audio": { "uri": "https://..." } }
```

24 kHz mono WAV — matches Aurora's `extractOutputUrl("uri")` key automatically.

## Resources

- GPU: NVIDIA T4 (16 GB) — Kokoro runs fine on CPU too; T4 speeds it up for long texts
- Warm inference: ~1–3 s per 200 words
- Cold start: ~20 s (model download cached after first run)

## Local testing (without inference.sh)

```bash
pip install -r requirements.txt
apt-get install -y espeak-ng   # phoneme backend

python - <<'EOF'
import sys; sys.modules["infsh"] = type(sys)("infsh")
class File:
    def __init__(self, path, content_type): self.path = path
sys.modules["infsh"].File = File

from inference import run
result = run({
    "text": "Welcome to Aurora Studio. Your creative AI companion.",
    "voice": "af_sky",
    "speed": 1.0,
})
print("Audio written to:", result["audio"].path)
EOF
```
