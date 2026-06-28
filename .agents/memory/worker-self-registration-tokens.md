---
name: GPU worker self-registration uses two distinct tokens
description: Why a worker needs both AURORA_REGISTER_KEY and AURORA_WORKER_TOKEN, and why they must stay separate.
---

# GPU worker self-registration: two tokens, not one

A self-hosted worker (Colab/Kaggle notebook → `workers/aurora_worker.py`,
`workers/kaggle/aurora_worker_kaggle.py`) that auto-registers into `gpu_workers`
on boot uses **two unrelated credentials**:

- `AURORA_REGISTER_KEY` — the Supabase **anon/publishable** key. Sent as the
  `apikey` header to `POST /api/public/workers/register` (and the same pattern
  guards `/api/public/workers/health`). This authenticates the worker *to Aurora*.
- `AURORA_WORKER_TOKEN` — the worker's **own `/generate` bearer** (optional). The
  worker enforces it on inbound generate calls, and forwards it in the register
  payload as `auth_token` so the dispatcher can authenticate *to the worker*.

**Why they must not be merged:** an early task spec said to reuse
`AURORA_WORKER_TOKEN` as the anon key, but that name already meant the /generate
bearer in `aurora_worker.py`. Collapsing them would either leak the worker's
inbound secret into the register header or break the existing /generate auth. So
a *separate* `AURORA_REGISTER_KEY` was introduced. Do not "simplify" by folding
one into the other.

**How to apply:** when adding worker setup docs, notebook secrets cells, or new
worker endpoints, keep the register/health auth on the anon key (`apikey` header)
and keep the /generate bearer independent. Five worker env vars total:
`NGROK_AUTHTOKEN`, `NGROK_STATIC_DOMAIN`, `AURORA_URL`, `AURORA_REGISTER_KEY`
(required) and `AURORA_WORKER_TOKEN` (optional).
