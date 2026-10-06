# Threat Model

## Project Overview

Aurora Studio is a public AI image, video, audio, lipsync, and storyboard application. The production deployment is a public Replit autoscale service running TanStack Start/Vite SSR with Node/Nitro server routes, Supabase Auth/Postgres/Storage, and server-side integrations for AI providers, payments, email, LANDR mastering, and GPU/render workers. The browser and several artifact frontends call the same production API.

## Assets

- **User accounts, sessions, and API/device credentials** — compromise permits impersonation, private gallery access, and paid generation.
- **Private creative content and media** — prompts, storyboard data, signed storage URLs, uploaded audio/images, generated assets, and job metadata.
- **Aura credits, payment state, and provider quotas** — unauthorized mutations or unmetered calls can cause financial loss and service exhaustion.
- **Provider and infrastructure secrets** — Supabase service role, AI/LANDR/provider tokens, and worker credentials authorize privileged external operations.
- **Administrative configuration** — feature visibility, site content/images, roles, orchestration and worker controls.

## Trust Boundaries

- **Public browser/artifact to server** — every request body, header, URL, file, and object identifier is attacker-controlled; client-side route hiding is not authorization.
- **Server to Supabase** — service-role calls bypass RLS and must apply explicit subject/object checks; anon/authenticated access must remain constrained by RLS.
- **Server to AI, payment, media, and LANDR providers** — user-controlled prompts, URLs, models, and callbacks must not select internal destinations or receive server credentials.
- **Server to GPU/render workers** — queue claims, heartbeats, completion URLs, and worker identity cross from public or semi-trusted clients into private job state.
- **User to admin/owner boundary** — admin passcodes, roles, feature visibility, billing, and operational APIs require server-side checks.
- **CLI device authorization boundary** — public device start/poll is intentionally unauthenticated but must be bounded, expiring, one-shot, and resistant to database exhaustion.

## Scan Anchors

- Production entry points: `src/routes/api/**`, TanStack server functions in `src/lib/**/*.functions.ts` and `*.server.ts`, `src/server.ts`, and worker routes under `workers/`.
- Highest-risk areas: `src/lib/orchestrator.server.ts`, generation/credit/payment flows, `src/lib/agent*.ts`, webhook and external-fetch helpers, `src/routes/api/public/**`, admin routes, and GPU/render job routes.
- Public surfaces include health, feature/content reads, payment/provider callbacks, device start/poll, selected generation integrations, and GPU worker endpoints. Authenticated surfaces include generation, gallery/jobs, agent, storage, and account operations. Admin/secret-gated surfaces include admin APIs and operational cron routes.
- `artifacts/**` contains frontends and some standalone/dev servers; treat them as production-relevant only when deployment wiring reaches them. `node_modules`, generated bundles, archives, and mock/test fixtures are normally non-production.

## Threat Categories

### Spoofing

All user-data and paid-generation operations MUST establish a verified Supabase subject or an explicitly authenticated worker identity. Device codes, admin passcodes, webhook signatures, payment callbacks, and worker credentials MUST be unpredictable, expiring, and validated on every use. Public queue endpoints must not accept caller-selected worker IDs as proof of identity.

### Tampering and Elevation of Privilege

Every object read or write MUST be scoped to the authenticated user, tenant, or authorized role at the server enforcement point. Hidden feature gates and frontend guards are insufficient. Credits, generation ownership, result URLs, admin settings, and provider parameters MUST be computed or validated server-side. Service-role database queries require explicit ownership checks.

### Information Disclosure

Private prompts, uploaded media, signed URLs, job rows, credentials, and provider responses MUST not be returned to unrelated users or public worker callers. External fetches MUST not expose internal services or forward application secrets to user-selected destinations. Error responses and logs MUST avoid secrets and sensitive provider details.

### Denial of Service and Resource Abuse

Public and authenticated expensive operations MUST have bounded body/file sizes, timeouts, rate limits, and per-subject or global budgets. Public device-code and callback endpoints MUST not permit unbounded database growth. AI, LANDR, GPU, and other paid provider calls MUST be tied to an authenticated account, credit reservation, or controlled operator quota.

### Injection and SSRF

URLs, model endpoints, redirects, file paths, prompts, and uploaded content cross trust boundaries. Server fetches MUST use explicit destination allowlists or robust private/link-local IP and redirect blocking, and must never forward privileged tokens to arbitrary URLs. Filesystem paths MUST be normalized and confined to intended roots. Database queries and process invocations MUST be parameterized and avoid shell interpretation.

### Repudiation and Integrity

Payment/webhook events, credit reservations/finalization, administrative changes, worker transitions, and sensitive account actions SHOULD retain auditable actor, timestamp, and idempotency data. Provider callbacks MUST be signature-verified and replay-resistant; job completion MUST be bound to the worker that claimed the job.
