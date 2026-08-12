# Aurora RunPod Serverless worker — LatentSync (lipsync) + MimicMotion (motion).
#
# Builds from EITHER context — the `src` stage below normalizes both:
#
#   repo root (what RunPod's GitHub-connected builder uses):
#       docker build -f workers/runpod/Dockerfile -t <you>/aurora-worker:latest .
#
#   legacy local command (workers/ as context — still supported):
#       docker build -f workers/runpod/Dockerfile -t <you>/aurora-worker:latest workers
#
# Gated weights (Stable-Video-Diffusion, needed by motion) require a Hugging
# Face token at build time:
#       docker build --build-arg HF_TOKEN=hf_xxx ...
# On RunPod, set HF_TOKEN as a build argument on the endpoint (see README).

# ── Stage 1: normalize the build context ─────────────────────────────────────
# RunPod's GitHub builder always builds with the repo root as context; the
# legacy local command passes the workers/ directory instead. Whichever we
# received, expose the workers tree at /w so stage 2 is context-agnostic.
FROM alpine:3.20 AS src
COPY . /ctx
RUN if [ -d /ctx/workers ]; then cp -r /ctx/workers /w; else cp -r /ctx /w; fi

# ── Stage 2: the worker image ────────────────────────────────────────────────
FROM runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04

WORKDIR /workspace

# System deps for video/audio IO.
RUN apt-get update && apt-get install -y --no-install-recommends \
    git ffmpeg && rm -rf /var/lib/apt/lists/*

# Clone + install the model repos and fetch weights (24 GB+). HF_TOKEN lets
# setup.sh log in to Hugging Face so the gated SVD weights bake into this
# layer; a lipsync-only build works without it. setup.sh deletes the login
# token before the layer commits, so the credential never persists in the
# image filesystem.
# NOTE: build ARGs still appear in image metadata (docker history) — keep the
# image private and use a fine-grained READ-only token.
COPY --from=src /w/setup.sh /workspace/setup.sh
ARG HF_TOKEN
RUN HF_TOKEN=$HF_TOKEN bash /workspace/setup.sh /workspace

# Runtime must point at the SAME HF cache (and login token) that setup.sh
# populated at build time — otherwise gated/lazy model pulls re-download to a
# fresh cache on every cold start.
ENV LATENTSYNC_DIR=/workspace/LatentSync \
    MIMICMOTION_DIR=/workspace/MimicMotion \
    HF_HOME=/workspace/hf_cache \
    HUGGINGFACE_HUB_CACHE=/workspace/hf_cache \
    AURORA_UPLOAD=catbox

# Aurora contract layer + RunPod handler.
COPY --from=src /w/requirements.txt /workspace/requirements.txt
COPY --from=src /w/runpod/requirements.txt /workspace/runpod-requirements.txt
RUN pip install --no-cache-dir -r /workspace/requirements.txt -r /workspace/runpod-requirements.txt

COPY --from=src /w/aurora_worker.py /workspace/aurora_worker.py
COPY --from=src /w/runpod/handler.py /workspace/handler.py

CMD ["python", "-u", "handler.py"]
