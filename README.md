# Aurora Performance Studio— AI Video Studio & Viral Video Engine

[![Viral Videos CI & Smoke Test](https://github.com/josephcrown920/Auroraglobal/actions/workflows/viral-videos-ci.yml/badge.svg)](https://github.com/josephcrown920/Auroraglobal/actions/workflows/viral-videos-ci.yml)

Auroraglobal is an end-to-end AI video creation platform and automated batch generation engine. It unifies full-stack generative video tools (Seedance 2.5, Kling 3.0, Dola Seed 2.1 Turbo, fal.ai, and Sync lip-sync) with automated, multi-layer FFmpeg compositing to produce broadcast-quality viral music video clips and short-form content from reference media.

---

## Table of Contents
1. [Architecture & Overview](#architecture--overview)
2. [Prerequisites & System Setup](#prerequisites--system-setup)
3. [Required Reference Assets](#required-reference-assets)
4. [Viral Video Plan Matrix (40 Scenes)](#viral-video-plan-matrix-40-scenes)
5. [BytePlus ModelArk Configuration](#byteplus-modelark-configuration)
6. [FFmpeg Compositing Engine Workflow](#ffmpeg-compositing-engine-workflow)
7. [Running Batch Video Generation](#running-batch-video-generation)
8. [CI/CD & Safe Smoke Testing](#cicd--safe-smoke-testing)
9. [Secrets & Security Policy](#secrets--security-policy)
10. [Repository Structure](#repository-structure)

---

## Architecture & Overview

The platform operates across two complementary environments:
1. **Interactive Web Studio**: Built on React 19 + TanStack Start, Tailwind CSS, and Lovable Cloud (Supabase). Features a node-based canvas, audio visualizers, and credit-based workflow routing.
2. **Batch Generation Engine (`generate_videos.py`)**: A programmatic pipeline combining BytePlus ModelArk video foundation models with headless FFmpeg compositing to produce 40 unique narrative scenes with zero manual editing.

Each generated video combines:
- **Foreground Layer (Character)**: NBA Josh performing with microphone on a chroma-green backdrop, synthesized via Seedance 2.5 with audio-driven lip sync and facial identity preservation.
- **Background Layer (Looping Scene)**: 2 Nigerian police officers on Lagos street locations, generated with Dola Seed 2.1 Turbo / Seedance 2.5, featuring idle whispering reconnaissance followed by looped high-energy sprints.
- **Post-Processing & Audio Bed**: Multi-track FFmpeg pipeline applying chromakey green-screen extraction, depth-of-field Gaussian blur, teal/contrast color grading, subtle vignette, film grain, and 3-stage dynamic audio mixing.

---

## Prerequisites & System Setup

### 1. System Dependencies
- **Python**: `>= 3.10`
- **Node / Bun**: Node 20+ or Bun 1.1+ (for web studio)
- **FFmpeg & FFprobe**: Must be installed and present on your system `PATH` with `libx264` and `aac` support.

#### macOS
```bash
brew install ffmpeg python
```

#### Ubuntu / Debian
```bash
sudo apt-get update
sudo apt-get install -y ffmpeg python3 python3-pip python3-venv
```

#### Windows
Install FFmpeg via [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) or `winget install Gyan.FFmpeg` and ensure FFmpeg is added to your environment `PATH`.

### 2. Python Environment Setup
```bash
# Clone the repository
git clone https://github.com/josephcrown920/Auroraglobal.git
cd Auroraglobal

# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install required packages
pip install -r requirements.txt
```

`requirements.txt` includes:
- `requests>=2.31.0` (REST API polling and asset uploads)
- `ffmpeg-python>=0.2.0` (declarative FFmpeg filter graph construction)

---

## Required Reference Assets

Before initiating batch video generation, place your reference audio and image assets into the `references/` folder. The generator inspects these exact relative paths:

```
references/
├── face_primary.jpg     # REQUIRED: Clear front-facing photo of NBA Josh
├── profile.jpg          # REQUIRED: Side/profile reference photo for walking shots
├── hook_audio.mp3       # REQUIRED: 15–30s master hook audio for lip-sync performance
├── street_ambience.mp3  # OPTIONAL: 5s atmospheric Lagos street noise bed
├── whoosh.mp3           # OPTIONAL: 1s cinematic transition whoosh sound effect
└── cops.jpg             # OPTIONAL: Reference image for uniform styling (leave empty if none)
```

### Asset Specifications
| Asset | Format | Resolution / Bitrate | Role in Generation Pipeline |
|---|---|---|---|
| `face_primary.jpg` | JPG / PNG | Min 1024x1024, high detail | Preserves dreadlocks with red tips, facial tattoos, goatee, and jewelry during performance. |
| `profile.jpg` | JPG / PNG | Min 1024x1024, side angle | Grounds the walk-in movement and lateral character silhouette. |
| `hook_audio.mp3` | MP3 / WAV | 44.1kHz or 48kHz, stereo | Feeds ModelArk's phoneme lip-sync engine and forms the audio climax. |
| `street_ambience.mp3`| MP3 / WAV | 48kHz stereo | Low-volume background bed during the first 5 seconds of the video. |
| `whoosh.mp3` | MP3 / WAV | 48kHz stereo | Triggers at 5.0s mark exactly when the officers begin sprinting. |

---

## Viral Video Plan Matrix (40 Scenes)

The repository provides 40 curated presets reflecting genuine Lagos urban, nightlife, and cultural settings. Each scene provides distinct costume combinations, authentic landmarks, lighting vibes, narrative endings, and background flairs.

- **Human-readable catalog**: [`docs/VIRAL_VIDEOS_40_PLANS.md`](docs/VIRAL_VIDEOS_40_PLANS.md)
- **Structured JSON dataset**: [`viral_video_plans.json`](viral_video_plans.json)
- **Tabular CSV spreadsheet**: [`viral_video_plans.csv`](viral_video_plans.csv)

### Preset Schema
```json
{
  "id": 1,
  "location": "Surulere, outside a suya spot",
  "outfit": "Red/Black Zillman long sleeve jersey + black frayed stacked jeans + white striped sneakers",
  "eatery": "Local suya restaurant",
  "vibe": "Golden hour sunset, smoke from the suya grill in the air, danfo buses parked on the side",
  "ending": "casually walks out of frame to the right",
  "flair": "Suya vendor standing in the far background"
}
```

Locations span **Surulere**, **Victoria Island**, **Ikeja**, **Lekki Phase 1**, **Yaba**, **Festac Town**, **Oniru**, **Banana Island**, **Ikoyi**, **Gbagada**, **Mushin**, **Apapa**, and more.

---

## BytePlus ModelArk Configuration

ModelArk settings live in the `CONFIG` section of `generate_videos.py` or can be set via environment variables.

```python
MODELARK_API_KEY = os.getenv("MODELARK_API_KEY", "YOUR_MODELARK_API_KEY_HERE")
API_BASE = "https://api.modelark.ai/v1"
MODE = "mixed"  # Options: "seedance-2.5", "dola-seed-2.1-turbo", "mixed"
NUM_VIDEOS = 40  # Number of scenes to generate from VIDEO_DB
```

### Generation Modes
| Mode | Foreground Character Model | Background Officers Model | Recommendation |
|---|---|---|---|
| **`mixed`** *(default)* | `seedance-2.5` | `dola-seed-2.1-turbo` | **Optimal**: Highest facial fidelity & 20s lip-sync for character; fast rendering for background loop. |
| **`seedance-2.5`** | `seedance-2.5` | `seedance-2.5` | Maximum cinematic fidelity across all layers; higher compute consumption. |
| **`dola-seed-2.1-turbo`** | `dola-seed-2.1-turbo` | `dola-seed-2.1-turbo` | High throughput generation with 10s performance limit. |

### Generation Task Flow
1. **Asset Staging**: Character images and audio are uploaded once via `POST /assets/upload`.
2. **Task Submission**: Asynchronous video jobs submitted via `POST /tasks/submit` with `motion_bucket`, `face_enhance=True`, and lip-sync flags.
3. **Polling & Timeout**: Tasks poll `GET /tasks/{id}` every 5s with exponential retry (up to 3 attempts with dynamic reference strength adjustments).

---

## FFmpeg Compositing Engine Workflow

The automated compositing pipeline stitches and layers the clips into an exported 1080p 60fps MP4:

```
[Character Walk (5s)] -> [Character Perf (10/20s)] -> [Character End (5s)]
                           │ (Concat Foreground)
                           ▼
                 [Chromakey #00FF00]
                           │
                           ▼
 [Cop Idle (5s)] ───► [Cop Sprint Loop] ──► [Background Blur + Teal Shift]
                           │                              │
                           └──────────────┬───────────────┘
                                          ▼
                               [FFmpeg Overlay (x=0, y=0)]
                                          │
                                          ▼
                         [Vignette + Contrast + Grain]
                                          │
       [Ambience (0-5s)] + [Whoosh (5s)] + [Hook Audio (6s+)] ──► [Audio Amix]
                                          │
                                          ▼
                        outputs/NBAJosh_LoopVideo_{id}.mp4
```

### Key Processing Stages
1. **Clip Normalization**: Rescales all incoming videos to `1920x1080` at `60 fps` using Lanczos filtering and centered padding.
2. **Cop Loop Generation**: Streams the 4-second sprint clip in an infinite loop (`stream_loop=-1`) cut to `total_duration - 5s`.
3. **Chromakey Removal**: Strips `#00FF00` pure green from character footage with `similarity=0.12` and `blend=0.08`.
4. **Cinematic Grading**:
   - Background: `gblur=sigma=1.5`, `colorbalance=bs=0.2:rs=-0.1:gs=-0.05` (cool teal shift), contrast `1.15`.
   - Master Grade: Vignette filter (`a=25`), global contrast boost (`1.2`), and unsharp sharpening (`lx=5:ly=5:la=0.8`).
5. **Audio Mixing**:
   - Track 1: Street ambience active during the opening 5-second suspense.
   - Track 2: 1-second whoosh sound effect delayed to 5.0 seconds.
   - Track 3: Full master hook audio mixed at 100% volume starting at 6.0 seconds.

---

## Running Batch Video Generation

```bash
# 1. Export your API credentials
export MODELARK_API_KEY="your-byteplus-modelark-api-key"

# 2. Verify all references are in place
ls -la references/

# 3. Launch generation
python generate_videos.py
```

### Outputs
- Final composited videos are saved to `outputs/NBAJosh_LoopVideo_{id}.mp4`.
- Intermediate downloaded clips are isolated in `temp_clips/` and automatically cleaned up after successful render.
- Every run appends timestamped status rows to `modelark_generation_log.csv`.

---

## CI/CD & Safe Smoke Testing

This repository includes continuous integration through GitHub Actions to ensure code quality and dataset integrity without exposing production secrets.

### GitHub Actions Workflow: `.github/workflows/viral-videos-ci.yml`
Runs automatically on:
- Every push to `Main` or `main` touching scripts, plans, or references.
- All pull requests.
- Manual execution via `workflow_dispatch`.

### Running the Smoke Test Locally
You can run the zero-secret validation suite at any time:

```bash
python scripts/test_viral_videos_smoke.py
```

The smoke test verifies:
1. `viral_video_plans.json` conforms to schema with all 40 scenes and non-empty required fields.
2. `viral_video_plans.csv` contains 40 complete rows matching the scene matrix.
3. Prompt synthesis functions (`build_walk_prompt`, `build_perf_prompt`, `build_end_prompt`, `build_cop_idle_prompt`, `build_cop_run_prompt`) produce valid cinematic instructions.
4. Generator code syntax, dependencies, and imports pass without making external network calls.

---

## Secrets & Security Policy

1. **Zero Hardcoded Secrets**: Never commit API keys, personal access tokens, or credentials into repository files.
2. **Environment Variable Ingestion**: Always supply `MODELARK_API_KEY`, `FAL_KEY`, or `KLING_*` keys via environment variables or secret managers.
3. **Git Hygiene**: `.gitignore` prevents `.env`, `temp_clips/`, `outputs/`, and `.venv/` from being pushed to remote.

---

## Repository Structure

```
├── .github/
│   └── workflows/
│       └── viral-videos-ci.yml       # GitHub Actions CI & smoke test
├── docs/
│   ├── VIRAL_VIDEOS_40_PLANS.md       # Complete 40-scene plan catalog
│   ├── VIRAL_VIDEO_EXECUTION_GUIDE.md # Video execution & operations guide
│   └── ...                           # Platform & architecture documentation
├── references/
│   └── README.md                     # Asset placement instructions
├── scripts/
│   └── test_viral_videos_smoke.py    # Zero-secret CI validation script
├── generate_videos.py                # Main ModelArk + FFmpeg batch generator
├── requirements.txt                  # Python runtime dependencies
├── viral_video_plans.csv             # 40-scene spreadsheet export
├── viral_video_plans.json            # 40-scene JSON database
├── package.json                      # Web platform dependencies
└── README.md                         # This documentation
```

---

## License

Proprietary — © Aurora Studio / Auroraglobal. All rights reserved.
