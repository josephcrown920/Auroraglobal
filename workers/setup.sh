#!/usr/bin/env bash
# Clone + install the self-hosted Aurora tasks and fetch their weights.
# Weights are NEVER bundled with Aurora — this pulls them from the official sources.
#
# Usage:  bash setup.sh [ROOT]
# Pick tasks with AURORA_TASKS (comma list); default installs both:
#   AURORA_TASKS=lipsync          LatentSync only — fits a 16 GB GPU (Kaggle/Colab free)
#   AURORA_TASKS=lipsync,motion   also MimicMotion — needs a ~24 GB GPU + ~25 GB disk
#
# A task that can't fit fails LOUDLY here (clear error + non-zero exit) instead of
# OOMing or running out of disk mid-job.
set -euo pipefail

ROOT="${1:-/workspace}"
# Comma list; tolerate stray spaces ("lipsync, motion") so callers and the worker
# agree on the installed set.
TASKS="$(printf '%s' "${AURORA_TASKS:-lipsync,motion}" | tr -d '[:space:]')"
mkdir -p "$ROOT"
cd "$ROOT"

# Keep HF weights under ROOT so a small home partition doesn't silently fill.
export HF_HOME="${HF_HOME:-$ROOT/hf_cache}"
export HUGGINGFACE_HUB_CACHE="$HF_HOME"
mkdir -p "$HF_HOME"

pip install -q "huggingface_hub[cli]"

have_task() { case ",$TASKS," in *",$1,"*) return 0 ;; *) return 1 ;; esac; }
disk_free_gb() { df -Pk "$ROOT" | awk 'NR==2 {printf "%d", $4 / 1024 / 1024}'; }
vram_gb() {
  if command -v nvidia-smi >/dev/null 2>&1; then
    nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null \
      | head -1 | awk '{printf "%d", $1 / 1024}'
  else
    echo 0
  fi
}

DISK="$(disk_free_gb)"
VRAM="$(vram_gb)"
echo "==> fit check: tasks=[$TASKS], ${DISK} GB free disk, ${VRAM} GB VRAM (0 = unknown)"

if have_task lipsync; then
  if [ "$DISK" -lt 10 ]; then
    echo "ERROR: lipsync (LatentSync) needs ~10 GB free disk; only ${DISK} GB available." >&2
    exit 1
  fi
  echo "==> LatentSync (lipsync)"
  if [ ! -d LatentSync ]; then
    git clone --depth 1 https://github.com/bytedance/LatentSync.git
  fi
  # Upstream pins mediapipe==0.10.11, which has no wheel for Python 3.12
  # (Kaggle/Colab's default interpreter) — only 0.10.13+ ship cp312 wheels.
  # Relax to the closest compatible release so `pip install` doesn't fail
  # loudly on newer-Python hosts; leave everything else pinned as upstream.
  sed -i -E 's/^mediapipe==0\.10\.11/mediapipe==0.10.14/' LatentSync/requirements.txt
  ( cd LatentSync && pip install -r requirements.txt )
  # Official weights (LatentSync 1.5) from the ByteDance HF repo — minimal set.
  # local-dir downloads default to symlink-from-cache in some huggingface_hub
  # versions; Kaggle's /kaggle/working can be a different filesystem than the
  # HF cache, which makes the symlink step fail silently-ish (exit 1, no
  # visible stack trace in notebooks that don't show stderr inline). Force a
  # real copy and surface the real error if it still fails.
  export HF_HUB_ENABLE_HF_TRANSFER=0
  if ! huggingface-cli download ByteDance/LatentSync-1.5 \
      --local-dir LatentSync/checkpoints --include "latentsync_unet.pt" "whisper/*"; then
    echo "ERROR: huggingface-cli download failed; retrying once with verbose logging so the real cause is visible:" >&2
    HF_HUB_VERBOSITY=debug huggingface-cli download ByteDance/LatentSync-1.5 \
      --local-dir LatentSync/checkpoints --include "latentsync_unet.pt" "whisper/*"
  fi
fi

if have_task motion; then
  if [ "$VRAM" -gt 0 ] && [ "$VRAM" -lt 20 ]; then
    echo "ERROR: motion (MimicMotion + SVD) needs a ~24 GB GPU; this GPU has ${VRAM} GB." >&2
    echo "       On a 16 GB card (Kaggle/Colab free) run lipsync only: AURORA_TASKS=lipsync." >&2
    exit 1
  fi
  if [ "$DISK" -lt 25 ]; then
    echo "ERROR: motion needs ~25 GB free disk; only ${DISK} GB available (try AURORA_TASKS=lipsync)." >&2
    exit 1
  fi
  echo "==> MimicMotion (motion)"
  if [ ! -d MimicMotion ]; then
    git clone --depth 1 https://github.com/Tencent/MimicMotion.git
  fi
  ( cd MimicMotion && pip install -r requirements.txt && mkdir -p models )
  # Official MimicMotion 1-1 checkpoint (the SVD base model is pulled at runtime).
  huggingface-cli download tencent/MimicMotion MimicMotion_1-1.pth \
    --local-dir MimicMotion/models
fi

if have_task image; then
  # SDXL-Turbo (default): ~7 GB disk, ~8 GB VRAM — fits T4/P100 (16 GB Kaggle free tier).
  # For FLUX.1-schnell: set IMAGE_MODEL=black-forest-labs/FLUX.1-schnell — needs ≥24 GB
  # VRAM and ≥24 GB free disk (A100/H100/L40S). The model weights download lazily on
  # first inference request (cached to HF_HOME).
  _SDXL_DISK_NEED=8
  if [ "$DISK" -lt "$_SDXL_DISK_NEED" ]; then
    echo "ERROR: image (SDXL-Turbo) needs ~${_SDXL_DISK_NEED} GB free disk; only ${DISK} GB available." >&2
    exit 1
  fi
  echo "==> Image generation (SDXL-Turbo / diffusers)"
  pip install -q "diffusers>=0.30" "transformers>=4.40" accelerate safetensors
  # Pre-fetch SDXL-Turbo weights into HF_HOME now so the first request is instant.
  # Skip if IMAGE_MODEL is overridden — the caller controls the download.
  _IMG_MODEL="${IMAGE_MODEL:-stabilityai/sdxl-turbo}"
  if echo "$_IMG_MODEL" | grep -qi "sdxl-turbo"; then
    echo "==> Pre-fetching SDXL-Turbo weights (${_IMG_MODEL}) …"
    python -c "
from diffusers import AutoPipelineForText2Image
import torch
AutoPipelineForText2Image.from_pretrained('${_IMG_MODEL}', torch_dtype=torch.float16, variant='fp16')
print('[image] SDXL-Turbo cached.')
" || echo "[image] WARNING: pre-fetch failed — weights will download on first request."
  fi
fi

echo "==> Done. Installed tasks: [$TASKS]. Before starting the worker, export:"
have_task lipsync && echo "    export LATENTSYNC_DIR=$ROOT/LatentSync"
have_task motion  && echo "    export MIMICMOTION_DIR=$ROOT/MimicMotion"
have_task image   && echo "    (image via diffusers — no extra export needed)"
