---
name: Model Watch scan
description: How Aurora's automatic new-AI-model discovery works — provider catalog endpoints, the unbillable ModelArk probe, idempotency design, and current BytePlus account activation status.
---

# Model Watch (automatic new-model discovery)

Cron-driven scan (6-hourly daemon block → `/api/public/model-watch`, anon-key `apikey` auth like every cron route) + admin "Scan now" at `/admin/models`. Rows in `model_watch` (service-role only).

## Provider access facts (reusable)
- **fal.ai catalog API is unauthenticated**: `GET https://fal.ai/api/models?keywords=<q>` → `items[]` with `id`, `title`, `category`, `status` ("public"), `deprecated`, `removed`, `publishedAt`. No key needed.
- **Replicate collections**: `GET https://api.replicate.com/v1/collections/<slug>` (Bearer token) — `text-to-video`, `image-to-video`, `text-to-image` all exist; unknown slugs 404 (skip, don't fail the scan).
- **ModelArk unbillable probe**: POST `contents/generations/tasks` with `{ model, content: [] }` — invalid payload can't enqueue a billable task. Classify by `error.code`: `ModelNotOpen` → account hasn't activated (slug REAL); `*NotFound` → dead slug; `InvalidParameter`/2xx → callable. (Full classification precedent: byteplus-modelark-live-verification.md.) Safety net: on unexpected 2xx, DELETE the task id immediately.

## Design rules (why it's lock-free)
- First scan per provider seeds baseline as status `seeded` with NO email (319 rows on 2026-08-04); only later `new` rows / `not_open→open` flips email the operator (one Resend email per scan).
- Concurrent scans (cron + admin) are safe WITHOUT a lock: catalog inserts use upsert `ignoreDuplicates` and only `.select()`-returned (actually-inserted) rows get emailed; availability transitions CAS on the prior value (`.eq("availability", prior)`) so exactly one scan records a flip.
- **Why:** review flagged double-email + unique-conflict 500s under concurrency; CAS + DO NOTHING closes both without an advisory-lock RPC.

## BytePlus account status (2026-08-04, reconfirmed 2026-08-10)
NO Seedance model is activated on the BytePlus account — probes for `dreamina-seedance-2-5-260628` (Aurora `seedance-2.5`, status "preview") AND the already-mapped `seedance-1-5-pro-251215` / `seedance-1-0-pro-*` slugs all return `ModelNotOpen`. Unlock is user-side in the Ark Console; the watcher emails when a probe flips to open, then flip the model's `status` to "live" in models.ts.

## ByteDance Seedance 2.0 campaign (2026-08-07 14:00 → 2026-09-07 14:00)
Limited-time ModelArk billing discount: "2.0 mini" at 40% of list (~$0.075/s full ≈ $0.375/5s @720p) and "2.0 Lite" at 75% (~$0.119/s full ≈ $0.59/5s). Owner decision: **keep Aura prices unchanged** — discount is margin only. **Why:** promo-based tiers invert into losses after expiry, so always tier off FULL list price; Lite full-list exceeds the budget pool, so `seedance-2.0-fast` must be retiered to standard BEFORE the Ark route is ever activated for that key. "2.0 mini" was absent from the ap-southeast catalog as of 2026-08-10 — the watcher carries a best-guess slug; when it appears, do the full 4-place registration, don't treat the alert as activation.

## Anticipated-probe rule
ARK_ANTICIPATED must probe the exact slugs `BYTEPLUS_DEFAULTS` dispatches — an "activated" flip is only meaningful if the app's own slug became serviceable (legacy sibling slugs can exist and activate without helping Aurora).

## Registration parity rule
A new BytePlus video model touches FOUR places: `VIDEO_MODEL_LIST` (models.ts), `VIDEO_MODEL_TIERS` (pricing.ts), `BYTEPLUS_DEFAULTS` AND `MODEL_REGISTRY` (orchestrator.server.ts) — the registry entry is easy to miss (review caught it for seedance-2.5).
