# Aurora self-hosted GPU workers

Ready-to-run templates that turn any GPU box into an Aurora backend for the
**self-hosted** media tasks:

- **`lipsync`** → [LatentSync](https://github.com/bytedance/LatentSync) (face video + audio → talking head)
- **`motion`** → [MimicMotion](https://github.com/Tencent/MimicMotion) (reference image + pose video → animated clip)

These tasks have **no hosted-API fallback** — when a user picks *LatentSync
(self-hosted)* or runs a Motion Transfer, Aurora routes the job **only** to a worker
you register here. If none is online, the user gets a clear "register a GPU worker"
error instead of a silent fallback.

## How it fits together

```
Aurora UI ──► orchestrator ──► your worker (this dir) ──► LatentSync / MimicMotion
                  │
                  └─ picks the worker by capability (lipsync / motion) + protocol
```

1. Stand up one of the templates below on a GPU.
2. Register it in **Admin → Workers** (the panel has per-platform recipes).
3. Pick *LatentSync (self-hosted)* in Lip-sync / Studio / Canvas, or use Motion Transfer.

## Templates

| dir          | platform                | protocol  | serves            |
| ------------ | ----------------------- | --------- | ----------------- |
| `runpod/`    | RunPod Serverless       | `runpod`  | lipsync + motion  |
| `hf-space/`  | Hugging Face Space      | `hfspace` | one task / Space  |
| `comfyui/`   | ComfyUI (any host)      | `comfyui` | lipsync + motion  |
| `kaggle/`    | Kaggle notebook + tunnel| `custom`  | lipsync (motion opt-in) |
| `aurora_worker.py` | any GPU VM (FastAPI)| `custom`  | lipsync + motion  |

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
`lipsync,motion` and the bearer token above. (Aurora normalizes the URL, so the bare
origin `https://<host>:8000` works too — it appends `/generate` and `/health` itself.)

> **Weights are never bundled.** `setup.sh` pulls LatentSync + MimicMotion checkpoints
> from their official sources. Pick tasks with `AURORA_TASKS` (default `lipsync,motion`):
> `lipsync` alone fits a 16 GB GPU (~10 GB download); `motion` (MimicMotion + SVD)
> needs a ~24 GB GPU and ~25 GB disk and **refuses to install on smaller cards**
> (clear error) rather than OOMing mid-job.
