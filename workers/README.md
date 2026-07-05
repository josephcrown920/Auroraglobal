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

## Colab (free GPU, `custom` protocol, self-registers)

Colab has no secrets-manager API like Kaggle's — set env vars directly in a cell, then
run the shared worker core. It self-registers the same way the Kaggle template does
(`register_with_aurora()` inside `aurora_worker.py`), as long as the same four values
are set: a stable tunnel domain, the Aurora URL, and the register key.

```python
# Cell 1 — one-time deps + a stable public URL (claim a free ngrok static domain first:
# dashboard.ngrok.com/domains — without it the URL changes every restart and Aurora
# treats each restart as a brand-new worker row).
!pip install -q pyngrok fastapi 'uvicorn[standard]' requests
import os
os.environ["NGROK_AUTHTOKEN"] = "…"          # dashboard.ngrok.com/get-started/your-authtoken
os.environ["NGROK_STATIC_DOMAIN"] = "foo-bar.ngrok-free.app"
os.environ["AURORA_URL"] = "https://your-app.replit.app"
os.environ["AURORA_REGISTER_SECRET"] = "…"      # private operator secret — set the same value in Aurora's env; never the Supabase key
os.environ["AURORA_TASKS"] = "lipsync"       # or "lipsync,motion" on an A100 (≥24 GB VRAM)

!curl -sO https://raw.githubusercontent.com/OWNER/REPO/BRANCH/workers/aurora_worker.py
!curl -sO https://raw.githubusercontent.com/OWNER/REPO/BRANCH/workers/setup.sh
!bash setup.sh /content
```

```python
# Cell 2 — start the worker (blocks the cell; keep the tab open). It waits for its own
# /health to answer, opens the ngrok tunnel, then calls register_with_aurora() —
# printing "[register] OK — …" on success or a clear reason on failure/skip.
import os, sys, threading, uvicorn
sys.path.insert(0, "/content")
os.environ["LATENTSYNC_DIR"] = "/content/LatentSync"
from aurora_worker import app, auto_register_when_ready
threading.Thread(target=auto_register_when_ready, daemon=True).start()
uvicorn.run(app, host="0.0.0.0", port=8000)
```

Confirm it worked the same way as Kaggle (see `kaggle/README.md` § 3): the cell prints
`[register] OK`, then **Admin → Workers** shows the row as **Active**.

## Vast.ai (rented GPU, `custom` protocol, manual registration)

Vast.ai instances expose a public port directly (no tunnel needed), so
`register_with_aurora()` — which only knows how to build a URL from
`NGROK_STATIC_DOMAIN` — does **not** apply here; register the instance once by hand
in **Admin → Workers** (Protocol: *Vast.ai*) instead of expecting auto-registration:

```bash
bash workers/setup.sh /workspace                        # or AURORA_TASKS=lipsync bash …
pip install -r workers/requirements.txt
export AURORA_WORKER_TOKEN=$(openssl rand -hex 16)       # optional bearer
uvicorn aurora_worker:app --host 0.0.0.0 --port 8000 --app-dir workers
```

Then paste the instance's public `https://<host>:<port>/generate` URL into
**Admin → Workers** with capabilities `lipsync,motion` and the bearer token above. On
every Vast.ai restart the instance gets a new public port/IP, so **re-paste the URL**
(or wrap the same `curl … /api/public/workers/register` call the Kaggle/Colab
templates use, with `endpoint_url` set to the instance's current address, in your own
boot script) — Aurora de-dupes on the normalized endpoint, so re-registering the same
worker under a new URL just updates its existing row once the old URL is replaced.
