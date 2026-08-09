---
name: ComfyUI Studio integration
description: How Aurora talks to the external ComfyUI Studio service (second Comfy backend beside gpu_workers)
---

Aurora has TWO Comfy backends: the Supabase `gpu_workers` queue and an external ComfyUI Studio REST service.

- Studio is gated on `COMFY_STUDIO_URL` (not set yet); server fns in `comfy.functions.ts` return `{configured:false}` and the `/comfy` StudioPanel hides itself.
- Studio runs reuse `comfy_runs` with `source='studio'` + `external_run_id` (Studio job ID). Migration applied live 2026-08-09.
- Polling: POST `/api/jobs/{id}/refresh` first, fall back to GET `/api/jobs/{id}`; network errors leave the run untouched and the client retries.
- Studio jobs currently charge NO Aura and there is no bearer-token support (guide says private deployments need `Authorization: Bearer`).
- Server-fn return types must use JSON-safe field types (`string|number|boolean|null`, not `unknown`) or TanStack's serializable validation fails TS2345.

**Why:** keep both backends separate; don't merge Studio into the gpu_workers dispatch path.
**How to apply:** any Studio work — set `COMFY_STUDIO_URL` first, then verify status/workflows load on /comfy.
