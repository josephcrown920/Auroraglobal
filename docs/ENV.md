# Environment & Secrets

Aurora runs directly against its own Supabase project and calls AI/media
providers directly (no Lovable Cloud/gateway dependency — see
`.agents/memory/lovable-export-independence.md`). There are two kinds of
configuration:

1. **Build-time env vars** (`VITE_*`) — inlined into the client bundle by
   Vite. Anything with a `VITE_` prefix is public; never put a real secret
   there.
2. **Runtime secrets** — read via `process.env.*` inside server-only code
   (`*.server.ts`, route `server.handlers`, or `createServerFn().handler()`).
   Never imported at module scope of a file that ships to the client, and
   never logged.

Manage secrets via Replit's Secrets pane (or the agent's secret-request
flow). Rotate in place and restart the affected workflow — never paste a
value into chat, source, issues, or test output.

## Startup validation

`src/lib/env-validation.server.ts` runs once when the server process boots
(`src/server.ts`):

- **Required** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SUPABASE_PUBLISHABLE_KEY`) — missing any of these throws immediately at
  boot. The app cannot serve a single request without a database
  connection, so failing fast here beats limping into confusing per-request
  500s.
- **Optional provider groups** (LLM fallback chain, media/video providers,
  self-hosted GPU workers, payments, cron/internal, observability) — a
  missing key only logs a value-free one-line summary at boot
  (`[env] <group>: missing ...`). These are designed to degrade gracefully:
  each adapter/provider already self-reports `enabled: !!process.env.X` and
  the orchestrator/LLM fallback chains skip whatever isn't configured.

Add a new required or optional key to that file's `REQUIRED_ENV` /
`OPTIONAL_ENV_GROUPS` when you introduce one, so it shows up in the boot log
instead of failing silently deep in a request handler.

## Build-time (`VITE_*`)

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (public) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon/publishable key (public, RLS-enforced) |
| `VITE_POSTHOG_KEY` | PostHog project key. Unset = PostHog fully disabled, no script/requests (`src/lib/posthog.ts`) |
| `VITE_POSTHOG_HOST` | PostHog ingestion host; defaults to `https://us.i.posthog.com` |

Like PostHog, analytics only fire after the visitor accepts cookie consent
(`src/lib/consent.ts`).

## Runtime secrets

### Supabase (core — required)

| Secret | Used by |
|---|---|
| `SUPABASE_URL` | Server + build mirror of the project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `client.server.ts` admin client (bypasses RLS) |
| `SUPABASE_PUBLISHABLE_KEY` | Server-side anon-key client / public endpoints |
| `SUPABASE_DB_PASSWORD` | Direct Postgres access for migrations and type generation (`scripts/check-supabase-types.sh`) — **not** `SUPABASE_DB_URL`, which is not a valid connection string in this project |

### AI providers — text/LLM fallback chain

Order in `src/lib/llm-fallback.server.ts` (each entry is skipped, not fatal,
if its key is absent): **Lovable AI Gateway → Gemini → OpenAI → Anthropic →
OpenRouter → Hugging Face router**. `src/lib/ai-router.ts`/category routing
is the current entry point for new call sites — `generateWithFallback` is
deprecated.

| Secret | Provider |
|---|---|
| `LOVABLE_API_KEY` | Lovable AI Gateway |
| `GEMINI_API_KEY` | Google Gemini direct |
| `OPENAI_API_KEY` | OpenAI direct |
| `ANTHROPIC_API_KEY` | Anthropic (OpenAI-compatible endpoint) |
| `OPENROUTER_API_KEY` | OpenRouter |
| `HF_TOKEN` | Hugging Face inference router |
| `AI_INTEGRATIONS_GEMINI_API_KEY` / `AI_INTEGRATIONS_GEMINI_BASE_URL` | Replit-managed Gemini proxy (no personal key needed) |
| `AI_INTEGRATIONS_OPENAI_API_KEY` / `AI_INTEGRATIONS_OPENAI_BASE_URL` | Replit-managed OpenAI proxy |

### Media / video / image providers

| Secret | Provider |
|---|---|
| `FAL_KEY` | fal.ai (Seedance, Seedream, some Kling endpoints) |
| `KLING_ACCESS_KEY` / `KLING_SECRET_KEY` | Kling AI direct (JWT access id/secret) |
| `REPLICATE_API_KEY` / `REPLICATE_API_TOKEN` | Replicate |
| `PIAPI_API_KEY` | PiAPI aggregator (Midjourney image, Kling video) |
| `RUNWAY_API_KEY` | Runway |
| `LTX_API_KEY` | LTX video |
| `BYTEPLUS_API_KEY` / `BYTEPLUS_BASE_URL` / `BYTEPLUS_MODEL_MAP` | BytePlus/ModelArk |
| `ARK_API_KEY` / `ARK_BASE_URL` | Volcano Ark |
| `HEYGEN_API_KEY` | HeyGen (talking avatar / photo-video) |
| `SEEDANCE_API_URL` / `SEEDANCE_API_KEY` | Aurora Soul video (dedicated Seedance direct-API adapter; no fallback — video fails explicitly if unset) |
| `SOUL_FAL_WEBHOOK_SECRET` | Optional extra `?secret=` gate on the Aurora Soul fal.ai training webhook, in addition to the always-on Ed25519 JWKS signature check |
| `SYNC_API_KEY` | Sync.so lip-sync |
| `ELEVENLABS_API_KEY` | ElevenLabs TTS |
| `GROQ_API_KEY` | Groq inference |
| `XAI_API_KEY` | xAI Grok (incl. Grok Imagine Video) |
| `LANDR_MASTERING_API_KEY` | LANDR audio mastering (not yet set) |
| `LOVABLE_CONNECTOR_REPLICATE_API_KEY` | Legacy Lovable-brokered Replicate credential |

### Self-hosted GPU workers / inference backends

| Secret | Used by |
|---|---|
| `AURORA_REGISTER_SECRET` | Worker self-registration (`apikey` header, anon-key scoped) |
| `RUNPOD_API_KEY` / `RUNPOD_ENDPOINT_ID` | RunPod adapter |
| `VASTAI_API_KEY` / `VAST_INFERENCE_URL` / `VAST_INFERENCE_TOKEN` | Vast.ai adapter + lifecycle management; the workspace `vastai` CLI/SDK reads the same key through the `usercustomize.py` hook (see `docs/VAST_TOOLS.md`) |
| `COMFYUI_URL` / `COMFYUI_TOKEN` / `COMFYUI_EDITOR_URL` | Self-hosted ComfyUI backend |
| `COMFY_STUDIO_URL` / `COMFY_API_KEY` | ComfyUI Studio (second backend, gated separately) |
| `HF_SPACE_URL` / `HF_FN_NAME` | Hugging Face Space worker |
| `CUSTOM_INFERENCE_URL` / `CUSTOM_INFERENCE_TOKEN` | Generic custom inference adapter |
| `INFERENCE_SH_API_KEY` / `INFERENCE_SH_BASE_URL` / `INFERENCE_SH_APP_IMAGE` / `INFERENCE_SH_APP_VIDEO` | inference.sh |
| `FREE_GPU_ONLY` | Dev/ops override forcing self-hosted-only routing |

### Payments & billing

| Secret | Purpose |
|---|---|
| `PAYSTACK_SECRET_KEY` | Paystack server API + webhook signature verify (NGN and USD; currency decided per-request by `src/lib/geo.functions.ts`) |
| `NOWPAYMENTS_API_KEY` / `NOWPAYMENTS_IPN_SECRET` | NOWPayments crypto checkout + webhook verify |
| `CONFIRM_SPEND` | Explicit opt-in guard before a script/smoke can spend real provider credit |

### Cron / internal / admin

| Secret | Purpose |
|---|---|
| `CRON_SECRET` | Shared secret for `/api/public/*` maintenance/cron endpoints |
| `INTER_APP_API_KEY` | Private internal calls, incl. the durable account-deletion sweep (`x-aurora-internal-key` header — never the public Supabase key) |
| `ADMIN_USERNAME` / `ADMIN_PASSCODE` | Admin dashboard passcode auth (in addition to a verified Supabase bearer) |
| `SESSION_SECRET` | HMAC secret for confirm tokens (e.g. Vast lifecycle confirm links) |

### Marketing / social

| Secret | Purpose |
|---|---|
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | TikTok OAuth app credentials |
| `TIKTOK_MARKETING_ACCESS_TOKEN` / `TIKTOK_ADVERTISER_ID` | TikTok Marketing API (real engagement metrics) |
| `RESEND_API_KEY` | Transactional email |
| `AURORA_ALERT_EMAIL` / `AURORA_FROM_EMAIL` | Ops alert + from-address for email notifications |

### Observability

| Secret | Purpose |
|---|---|
| `SENTRY_DSN` | Optional server-side exception reporting |

### Misc / deploy

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port the server binds (Replit assigns this per-artifact) |
| `SITE_URL` / `BASE_URL` | Canonical site URL for links/redirects/meta |
| `REPLIT_DEV_DOMAIN` / `REPLIT_DOMAINS` | Replit-provided dev/prod domain(s) — never hardcode these into app code paths; see the deployment skill for the real production URL |
| `NODE_ENV` | Standard Node environment flag |
| `SMOKE_BASE_URL` | Base URL used by `scripts/smoke-*.ts` scripts against a running deployment |

---

## Adding a new secret

1. Request it via the agent's secret-request flow, or Project Settings → Secrets.
2. Read it inside server-only code:
   ```ts
   export const fn = createServerFn({ method: "POST" }).handler(async () => {
     const key = process.env.MY_NEW_KEY!;
     // ...
   });
   ```
3. Never reference `process.env.*` in client code or at module scope of a
   shared (non-`.server.ts`) file — it will be `undefined` in the browser.
4. If it's required for the app to run at all, add it to `REQUIRED_ENV` in
   `src/lib/env-validation.server.ts`. If it's a feature-scoped provider
   key, add it to the relevant `OPTIONAL_ENV_GROUPS` entry so a missing key
   shows up in the boot log.

## Rotating secrets

Rotate in the platform secret manager, restart the affected workflow, and
verify the corresponding 401/200 smoke checks. `LOVABLE_API_KEY` (if still
present in a given environment) is the one managed exception — rotate it
through its dedicated rotate tool rather than the generic secret UI.
