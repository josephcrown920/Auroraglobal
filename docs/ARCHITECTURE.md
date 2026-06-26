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

`src/lib/orchestrator.server.ts` routes `image | video | lipsync | upscale` requests to:

1. **Lovable AI** (image gen via gateway)
2. **fal.ai** (Seedance, Seedream, Kling endpoints mapped in `FAL_ENDPOINTS`)
3. **GPU workers** (rows in `gpu_workers`, tracked in `worker_jobs`)
4. **Replicate** (placeholder adapter)

Each provider has in-memory health tracking with cooldown on failure. Every attempt is logged to `provider_logs` with latency + cost.

### GPU worker contracts

A `gpu_workers` row declares the request contract it speaks via its `protocol` column, so the orchestrator can call heterogeneous backends without a separate service:

- **`custom`** (default) — `POST {endpoint}/generate` with a flat JSON body, returns `{ url }` / `{ output_url }`. This is the original contract; existing workers keep working unchanged.
- **`runpod`** — RunPod Serverless. The flat params are wrapped as `{ "input": {...} }` and sent to `POST {endpoint}/run` (async — the job id is then polled at `GET {endpoint}/status/{id}` until terminal), or to `POST {endpoint}/runsync` when the row sets `runpod_sync = true`. Status flow follows RunPod's `IN_QUEUE → IN_PROGRESS → COMPLETED` (terminal failures: `FAILED | CANCELLED | TIMED_OUT`). The `auth_token` is sent as `Authorization: Bearer`.

Both contracts share `extractWorkerUrl()`, which finds the output URL whether it's a bare string, an array, a top-level `url`/`output_url`, or nested under RunPod's `output`. Routing stays capability-based (`capabilities` + `priority` + `in_flight`); `protocol` only changes *how* a chosen worker is invoked. `worker_role` (`comfyui | kling | lipsync | motion`) is operator metadata only and does not affect routing.

## Payments

Paystack handles NGN credit purchases. Webhook at `/api/public/paystack-webhook` verifies the `x-paystack-signature` HMAC, then calls `grant_credits()` server-side.

## Cron

Public cron-style endpoints under `/api/public/*` are protected by the shared `CRON_SECRET` header. Use the stable URL `project--07d08629-5cb9-4317-a630-4f3e2c0ce79f.lovable.app` when wiring external schedulers.
