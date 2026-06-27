# Aurora RunPod Serverless worker — LatentSync (lipsync) + MimicMotion (motion).
# Build context = the repo `workers/` directory:
#     docker build -f runpod/Dockerfile -t you/aurora-worker:latest workers
FROM runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04

WORKDIR /workspace

# System deps for video/audio IO.
RUN apt-get update && apt-get install -y --no-install-recommends \
    git ffmpeg && rm -rf /var/lib/apt/lists/*

# Clone + install the model repos and fetch weights (24 GB+; needs HF auth for SVD).
COPY setup.sh /workspace/setup.sh
RUN bash /workspace/setup.sh /workspace

ENV LATENTSYNC_DIR=/workspace/LatentSync \
    MIMICMOTION_DIR=/workspace/MimicMotion \
    AURORA_UPLOAD=catbox

# Aurora contract layer + RunPod handler.
COPY requirements.txt /workspace/requirements.txt
COPY runpod/requirements.txt /workspace/runpod-requirements.txt
RUN pip install --no-cache-dir -r /workspace/requirements.txt -r /workspace/runpod-requirements.txt

COPY aurora_worker.py /workspace/aurora_worker.py
COPY runpod/handler.py /workspace/handler.py

CMD ["python", "-u", "handler.py"]
