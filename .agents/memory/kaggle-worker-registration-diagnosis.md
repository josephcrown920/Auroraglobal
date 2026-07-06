---
name: Kaggle worker registration diagnosis
description: How to diagnose why a self-hosted Kaggle/Colab GPU worker isn't showing up as registered with Aurora.
---

Aurora's self-hosted GPU worker flow: a notebook (Kaggle/Colab) starts a local FastAPI server, opens an ngrok tunnel, then POSTs to `/api/public/workers/register` with an `apikey` header that must match `AURORA_REGISTER_SECRET`.

**Why this needs a specific diagnosis path:** the notebook's own "✅ WORKER IS LIVE" print is not reliable evidence of success — registration can fail (auth mismatch, missing secrets, tunnel never opened) while the rest of the script prints success banners regardless. Kaggle Secrets are attached **per-notebook** and silently produce empty env vars if not attached/renamed correctly (typical notebook code wraps secret loading in a bare `except: pass`).

**How to apply:**
- Don't trust the notebook output; check the source of truth directly: query `gpu_workers` (should gain a row with `status: 'active'` and a fresh `last_heartbeat`) and `worker_register_attempts` (shows real request outcomes, e.g. "Unauthorized" vs a clean success) in the Supabase DB.
- If registration attempts show "Unauthorized (apikey mismatch or missing)" repeatedly, the most common cause is the Kaggle Secret for `AURORA_REGISTER_SECRET` not being attached to that specific notebook session (not a code bug) — same failure mode as `NGROK_AUTHTOKEN` not loading (causes `ERR_NGROK_4018`).
- Recommend the user add a one-line diagnostic print of which secrets loaded (booleans only, never the values) right after the secret-loading block, instead of discovering the gap several steps downstream when ngrok/registration fails.
