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

**Health tracking** is lazy/at-dispatch: workers whose `last_heartbeat` is older than 5 minutes are skipped. No background daemon is needed — the admin "Ping" button and successful/failed dispatches both refresh the heartbeat. `auth_token` RLS is preserved (revoked from `authenticated` and `anon`).

## Payments

Paystack handles NGN credit purchases. Webhook at `/api/public/paystack-webhook` verifies the `x-paystack-signature` HMAC, then calls `grant_credits()` server-side.

## Cron

Public cron-style endpoints under `/api/public/*` are protected by the shared `CRON_SECRET` header. Use the stable URL `project--07d08629-5cb9-4317-a630-4f3e2c0ce79f.lovable.app` when wiring external schedulers.
