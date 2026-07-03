# Architecture

## Server runtime

Cloudflare Workers (`workerd`) with `nodejs_compat`. All server logic is bundled at build time — no runtime module resolution. Avoid Node-only packages (sharp, canvas, child_process, etc).

## Server logic patterns

- **`createServerFn`** (`@tanstack/react-start`) — typed RPC for the app. Files: `src/lib/*.functions.ts`. Call from components via `useServerFn` + `useQuery`, or from `_authenticated/` loaders.
- **Server routes** (`createFileRoute` with `server.handlers`) — raw HTTP. Files: `src/routes/api/public/*`. Used for webhooks (`paystack-webhook`) and public endpoints (`generate`).
- **`requireSupabaseAuth` middleware** — wraps server fns that need a user context. Pairs with global `attachSupabaseAuth` registered in `src/start.ts`.

## LLM fallback chain

`src/lib/llm-fallback.server.ts` exposes `generateWithFallback()`. Each provider is registered as an OpenAI-compatible client and tried in order, retrying on 429 / 402 / network errors:

```
Lovable AI  →  Gemini direct  →  OpenAI direct  →  OpenRouter
```

The agent (`src/lib/agent.functions.ts`) uses this for structured JSON outputs.

## Media orchestrator

`src/lib/orchestrator.server.ts` routes `image | video | lipsync | upscale` requests through a priority chain (tried in order per kind):

1. **Lovable AI** (image gen via gateway)
2. **fal.ai** (Seedance, Seedream, Kling endpoints mapped in `FAL_ENDPOINTS`)
3. **GPU workers** (rows in `gpu_workers`, tracked in `worker_jobs`)
4. **Replicate** (placeholder adapter)

| Kind | Chain |
|------|-------|
| image | Gemini direct → HuggingFace → Replicate → Lovable → GPU workers → Fal |
| video | Kling direct → Replicate → GPU workers → Fal |
| lipsync | Sync.so → HeyGen → Replicate → GPU workers → Fal |
| upscale | Replicate → GPU workers → Fal |
Each provider has in-memory health tracking with exponential cooldown on failure. Every attempt is logged to `provider_logs` with latency + cost. A model-level fallback list (`FALLBACK_MODELS`) re-tries cheaper same-kind models before giving up.

### GPU worker pool (`gpu_workers` table)

Workers are registered through `/admin` and dispatched by the `gpuWorker` adapter. Two request contracts are supported, selected per-worker via the `protocol` column:

| `protocol` | Request shape | Response |
|---|---|---|
| `custom` (default) | `POST /generate` flat JSON body | `{ url }` |
| `runpod` | `POST /runsync` (preferred) or `POST /run` + `GET /status/{id}` with `{ input: { kind, prompt, image_urls, audio_url, video_url, model, duration, resolution } }` | RunPod output shape |

Both styles coexist in the same registry and failover chain. Use `priority` to model the Python pipeline's primary → dedicated → serverless ordering: dedicated workers at lower priority numbers, serverless/auto-scale endpoints at higher priority (e.g. 200) so they act as the last-resort tier.

**Worker roles** (optional `worker_role` column) map to capabilities as follows — this is a display/routing hint; capabilities drive actual routing:

| `worker_role` | capabilities |
|---|---|
| `comfyui` | image, upscale |
| `kling` | video |
| `lipsync` | lipsync |
| `motion` | video |

**Health tracking** is lazy/at-dispatch plus a periodic sweep: workers whose `last_heartbeat` is older than 5 minutes are skipped at dispatch, the admin "Ping" button and successful/failed dispatches refresh the heartbeat, and the cron endpoint `POST /api/public/workers/health` runs `checkGPUWorkerHealth` on a schedule to probe every `custom`/`runpod` worker and flip it `active`/`paused` (skipping admin `draining`/`paused` states) without anyone clicking Ping. `auth_token` RLS is preserved (revoked from `authenticated` and `anon`).

### GPU worker contracts

A `gpu_workers` row declares the request contract it speaks via its `protocol` column, so the orchestrator can call heterogeneous backends without a separate service:

- **`custom`** (default) — `POST {endpoint}/generate` with a flat JSON body, returns `{ url }` / `{ output_url }`. This is the original contract; existing workers keep working unchanged.
- **`runpod`** — RunPod Serverless. The flat params are wrapped as `{ "input": {...} }` and sent to `POST {endpoint}/run` (async — the job id is then polled at `GET {endpoint}/status/{id}` until terminal), or to `POST {endpoint}/runsync` when the row sets `runpod_sync = true`. Status flow follows RunPod's `IN_QUEUE → IN_PROGRESS → COMPLETED` (terminal failures: `FAILED | CANCELLED | TIMED_OUT`). The `auth_token` is sent as `Authorization: Bearer`.

Both contracts share `extractWorkerUrl()`, which finds the output URL whether it's a bare string, an array, a top-level `url`/`output_url`, or nested under RunPod's `output`. Routing stays capability-based (`capabilities` + `priority` + `in_flight`); `protocol` only changes *how* a chosen worker is invoked. `worker_role` (`comfyui | kling | lipsync | motion`) is operator metadata only and does not affect routing.

## Payments

Paystack handles NGN credit purchases. Webhook at `/api/public/paystack-webhook` verifies the `x-paystack-signature` HMAC, then calls `grant_credits()` server-side.

## Cron

Public cron-style endpoints under `/api/public/*` are triggered by an external scheduler (Supabase pg_cron) because the app runs on Replit autoscale (request-driven, scales to zero) and therefore cannot keep a durable in-process timer. Authentication accepts a `CRON_SECRET` (preferred) **or**, for backward compatibility, the Supabase anon/publishable key — either credential may be sent as the `apikey` header or as `Authorization: Bearer <value>`. Use the stable URL `project--07d08629-5cb9-4317-a630-4f3e2c0ce79f.lovable.app` when wiring external schedulers.

| Endpoint | Suggested schedule | Purpose |
|---|---|---|
| `POST /api/public/jobs/tick` | every ~minute | Sweep orphaned `processing` jobs back to `queued`, re-enqueue orphaned `failed` jobs/generations, drain the `public.jobs` queue, and record a scheduler heartbeat |
| `POST /api/public/workers/health` | every ~5 minutes | Probe GPU workers and auto-flip `active`/`paused` |

### Persistent retry + scheduler health

Each `jobs/tick` call: (1) re-queues jobs stuck in `processing` past `STALE_PROCESSING_SECONDS` (their credit reservation is still held, so this is credit-safe), (2) re-enqueues orphaned `failed` jobs that should still be retried (`sweepFailedJobs`), (3) runs a bounded batch of the queue, and (4) upserts a `scheduler_heartbeats` row. Transient/unknown failures are re-queued with capped exponential backoff (base 30s → cap 30m, +jitter) and keep retrying until they either succeed or hit a bound — `PERSISTENT_RETRY_MAX_ATTEMPTS` (48) **or** `PERSISTENT_RETRY_MAX_AGE_MS` (48h). Terminal errors (auth/validation/capability — see `classifyJobError`) stop immediately. The reservation is released **only** on a terminal/exhausted outcome (never on a retry), so credits are never double-charged or refunded mid-flight. The admin overview surfaces the latest heartbeat (a stalled cron is visible there) plus per-generation attempt counts.

**Orphan-failure recovery.** The normal loop keeps transient failures in `queued`, so the only jobs that reach `failed` are terminal, exhausted, or pre-date persistent retry (the old `attempts < max_attempts` cap marked them failed permanently). `sweepFailedJobs` re-enqueues the recoverable ones — `failed` jobs with a *transient* error still inside the attempt/age bounds — applying the exact same `classifyJobError` gate as the worker loop so hopeless jobs are never resurrected. Because every generation is created together with a job (`create_generation_and_reserve`), this also recovers their linked `failed` generations; there are no job-less generations to sweep. Credit-safe by construction: a `failed` job already had its reservation released, so recovery **re-reserves fresh** credits atomically inside the `requeue_failed_job` RPC (re-reserve + flip to `queued`, under a row lock) — a user who can no longer afford the job is left `failed`, and a successful retry commits exactly the re-reserved amount.

### Wiring pg_cron (Supabase dashboard)

Run once in the Supabase SQL editor (enables the extensions, then schedules the ticks). Replace `<APP_URL>` with the stable URL above and `<ANON_OR_CRON_SECRET>` with either the anon key (`apikey` header) or `CRON_SECRET` (`Authorization` header):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Drain + sweep + heartbeat every minute.
select cron.schedule('aurora-jobs-tick', '* * * * *', $$
  select net.http_post(
    url     := 'https://<APP_URL>/api/public/jobs/tick',
    headers := jsonb_build_object('Content-Type','application/json','apikey','<ANON_OR_CRON_SECRET>'),
    body    := '{}'::jsonb
  );
$$);

-- Probe GPU workers every 5 minutes.
select cron.schedule('aurora-workers-health', '*/5 * * * *', $$
  select net.http_post(
    url     := 'https://<APP_URL>/api/public/workers/health',
    headers := jsonb_build_object('Content-Type','application/json','apikey','<ANON_OR_CRON_SECRET>'),
    body    := '{}'::jsonb
  );
$$);

-- Inspect / remove:
--   select * from cron.job;
--   select cron.unschedule('aurora-jobs-tick');
```

pg_cron is not available in the local dev/migration environment, so scheduling lives in the dashboard rather than a migration. If ticks stop landing, the admin scheduler banner shows the last heartbeat age so a stalled cron is observable.
