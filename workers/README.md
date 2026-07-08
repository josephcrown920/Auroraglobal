# Aurora self-hosted GPU workers

Ready-to-run templates that turn any GPU box into an Aurora backend. Two routing
classes:

- **Swarm-first (hosted fallback):** `image` and `video`. Aurora tries your
  self-hosted workers first, then falls back to a hosted provider if none is free.
  The free-GPU **ComfyUI swarm** (`comfyui/`) is built for this — spin up Kaggle/Colab
  GPUs and they auto-join.
- **Self-hosted only (no fallback):** `lipsync`, `motion`, and `assemble`.
  - **`lipsync`** → [LatentSync](https://github.com/bytedance/LatentSync) (face video + audio → talking head)
  - **`motion`** → [MimicMotion](https://github.com/Tencent/MimicMotion) (reference image + pose video → animated clip)
  - **`assemble`** → ffmpeg-only stitch for the faceless Kids Story Studio (scenes + narration + music → one MP4). No GPU or model install — advertised by default on any worker that has ffmpeg.

  When a user picks *LatentSync (self-hosted)* or runs a Motion Transfer, Aurora
  routes the job **only** to a worker you register here. If none is online, the user
  gets a clear "register a GPU worker" error instead of a silent fallback.

## How it fits together

```
Aurora UI ──► orchestrator ──► your worker (this dir) ──► LatentSync / MimicMotion
                  │
                  └─ picks the worker by capability (lipsync / motion) + protocol
```

1. Stand up one of the templates below on a GPU.
2. Register it in **Admin → Workers** (the panel has per-platform recipes).
3. Pick *LatentSync (self-hosted)* in Lip-sync / Studio / Canvas, or use Motion Transfer.

> **Registration alone is not enough.** A registered worker only gets dispatched
> jobs if the app owner has wired the two recurring `pg_cron` jobs
> (`aurora-jobs-tick` every ~minute, `aurora-workers-health` every ~5 minutes)
> against a real Supabase project — Replit autoscale has no durable in-process
> timer, so nothing drains the `public.jobs` queue or refreshes worker health
> without them. See `docs/ARCHITECTURE.md` → "Wiring pg_cron". If a worker shows
> **Active** in Admin but jobs never leave `queued`, this is the first thing to
> check — not the worker itself.

## Templates

| dir          | platform                  | protocol  | serves            |
| ------------ | ------------------------- | --------- | ----------------- |
| `comfyui/`   | ComfyUI — incl. free-GPU Kaggle/Colab swarm | `comfyui` | image + video + lipsync + motion |
| `runpod/`    | RunPod Serverless         | `runpod`  | lipsync + motion  |
| `hf-space/`  | Hugging Face Space        | `hfspace` | one task / Space  |
| `kaggle/`    | Kaggle notebook + tunnel  | `custom`  | lipsync (motion opt-in) |
| `colab/`     | Colab notebook + tunnel   | `custom`  | lipsync (motion opt-in, Pro+ A100 only) |
| `vast/`      | Vast.ai rented GPU (auto-registers, no tunnel) | `vast` | lipsync + motion + assemble (GPU-tier dependent) |
| `aurora_worker.py` | any GPU VM (FastAPI)| `custom`  | lipsync + motion + assemble |

> **Free-GPU swarm:** `comfyui/aurora_comfyui_launcher.py` runs stock ComfyUI on a
> free Kaggle or Colab GPU, health-gates on `/system_stats`, opens a stable ngrok
> tunnel, and auto-registers as `protocol=comfyui` advertising only the capabilities
> its VRAM, installed models, and loaded custom nodes can serve. Aurora fans `image`/`video` out to the
> least-loaded online worker first and falls back to a hosted provider only if the
> swarm is empty or busy. See [`comfyui/README.md`](./comfyui/README.md).

The shared core is **`aurora_worker.py`** — one `process_job()` with two entrypoints
(FastAPI for `custom`, `handler()` for RunPod). The wire contract every template
targets is in **[`CONTRACT.md`](./CONTRACT.md)**.

## Quick start (generic GPU VM, `custom` protocol)

```bash
bash workers/setup.sh                      # clone LatentSync + MimicMotion, fetch weights
pip install -r workers/requirements.txt
export AURORA_UPLOAD=supabase              # or "catbox" (default, no account)
export SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… SUPABASE_BUCKET=studio
export AURORA_WORKER_TOKEN=$(openssl rand -hex 16)   # optional bearer
uvicorn aurora_worker:app --host 0.0.0.0 --port 8000 --app-dir workers
```

Then register `https://<host>:8000/generate` as a `custom` worker with capabilities
`lipsync,motion,assemble` and the bearer token above. (Aurora normalizes the URL, so the bare
origin `https://<host>:8000` works too — it appends `/generate` and `/health` itself.)

> **Weights are never bundled.** `setup.sh` pulls LatentSync + MimicMotion checkpoints
> from their official sources. Pick tasks with `AURORA_TASKS` (default `lipsync,motion`):
> `lipsync` alone fits a 16 GB GPU (~10 GB download); `motion` (MimicMotion + SVD)
> needs a ~24 GB GPU and ~25 GB disk and **refuses to install on smaller cards**
> (clear error) rather than OOMing mid-job.

## Colab (free GPU, `custom` protocol, self-registers, turnkey)

Same one-cell shape as Kaggle: paste [`colab/aurora_worker_colab.py`](./colab/aurora_worker_colab.py)
or import [`colab/aurora_worker_colab.ipynb`](./colab/aurora_worker_colab.ipynb), add the
secrets in Colab's **Secrets** panel (key icon, left sidebar — toggle notebook access ON
for each), and **Runtime → Run all**. It bridges `google.colab.userdata` into the
environment, fetches `aurora_worker.py` + `setup.sh` from your repo, installs the task(s)
that fit your tier (lipsync by default — fits any free T4), opens a stable ngrok tunnel,
and self-registers via `register_with_aurora()` — identical flow to `kaggle/`, just a
different secrets API and root dir (`/content` vs `/kaggle/working`). See
[`colab/README.md`](./colab/README.md) for the full secrets table and setup steps.

## Vast.ai (rented GPU, `vast` protocol, auto-registers)

Vast.ai instances expose container ports directly — no tunnel needed. The dedicated
launcher at [`vast/aurora_worker_vast.py`](./vast/aurora_worker_vast.py) detects the
public URL from Vast.ai's `VAST_TCP_HOST`/`VAST_TCP_PORT_8000` env vars, installs
weights, starts the FastAPI worker, and **auto-registers** with Aurora.

**Quick start** — set `AURORA_URL`, `AURORA_REGISTER_SECRET`, and optionally
`AURORA_TASKS` / `AURORA_WORKER_TOKEN` in your Vast.ai instance template (under
**Environment**), open port **8000**, then SSH in and run:

```bash
apt-get install -y ffmpeg 2>/dev/null || true
python3 - << 'EOF'
import os, urllib.request
url = os.environ["AURORA_URL"].rstrip("/") + "/api/public/workers/files/vast_bootstrap.py"
urllib.request.urlretrieve(url, "/workspace/aurora_worker_vast.py")
EOF
python3 /workspace/aurora_worker_vast.py
```

See [`vast/README.md`](./vast/README.md) for the full secrets table, GPU tier guide,
and troubleshooting steps.
