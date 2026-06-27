#!/usr/bin/env bash
# Clone + install LatentSync (lipsync) and MimicMotion (motion) and fetch weights.
# Weights are NEVER bundled with Aurora — this pulls them from the official sources.
# Expect a 24 GB+ download and a 24 GB-VRAM GPU.
set -euo pipefail

ROOT="${1:-/workspace}"
mkdir -p "$ROOT"
cd "$ROOT"

echo "==> LatentSync (lipsync)"
if [ ! -d LatentSync ]; then
  git clone https://github.com/bytedance/LatentSync.git
fi
cd LatentSync
pip install -r requirements.txt
# Official weights (LatentSync 1.5) from the ByteDance HF repo.
huggingface-cli download ByteDance/LatentSync-1.5 \
  --local-dir checkpoints --include "latentsync_unet.pt" "whisper/*" || true
cd "$ROOT"

echo "==> MimicMotion (motion)"
if [ ! -d MimicMotion ]; then
  git clone https://github.com/Tencent/MimicMotion.git
fi
cd MimicMotion
pip install -r requirements.txt
mkdir -p models
# Official MimicMotion 1-1 checkpoint.
huggingface-cli download tencent/MimicMotion MimicMotion_1-1.pth \
  --local-dir models || true
cd "$ROOT"

echo "==> Done. Set these before starting the worker:"
echo "    export LATENTSYNC_DIR=$ROOT/LatentSync"
echo "    export MIMICMOTION_DIR=$ROOT/MimicMotion"
