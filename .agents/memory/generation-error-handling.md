---
name: Generation error handling
description: How customer-facing generation errors are classified/surfaced and the constraints that keep it correct (classification order, exact provider strings, retry-hint honoring).
---

# Generation error handling (customer-facing)

All customer generation errors funnel through `src/lib/error-toasts.ts`:
`classifyGenerationError` → `friendlyGenerationMessage` / `handleGenerationError`.
Routes (studio, canvas animate, lipsync, motion, ugc, orchestrate) call the helper
instead of `toast.error(e instanceof Error ? e.message : …)`.

## Classification ORDER is load-bearing
`out_of_credit` MUST be checked before `rate_limited`.
**Why:** Replicate's provider-account low-balance throttle is an HTTP **429** whose
body also says "rate limit" (".. reduced to N requests per minute while you have
less than $5.0 in credit .."). A plain order would misfile an owner-funding problem
as a generic throttle. out_of_credit also logs a `[PROVIDER]` owner signal (console)
while still showing the customer a neutral "service busy, try again" message.
**How to apply:** if you add/reorder kinds, keep the more-specific balance signal
ahead of the broad throttle bucket.

## "unknown → show raw message" is deliberate, not a leak
Recognized failures map to safe copy; only `unknown` returns the raw string.
App-authored validation messages ("Generate a base shot first", "Add a reference
image", "sync: video+audio required") are short, customer-useful, and intentionally
pass through. Anything that looks like a provider dump is caught first:
`<Provider> <status>: <body>` (regex `(^|\s)\d{3}\s*:`), `worker … -> 500`
(`->\s*\d{3}`), JSON braces, `worker ` prefix, and owner-misconfig phrases
("no replicate mapping", "unsupported", "no path for kind"). 402 in a dump → out_of_credit.
**How to apply:** new provider adapters that throw `"<Name> <status>: <body>"` are
covered automatically; a brand-new error *shape* may need a new branch before the raw fallback.

## Exact provider error strings are a cross-module contract
`replicate.server.ts` throws EXACTLY `Replicate create failed (NNN): …` /
`Replicate poll failed (NNN): …`. Orchestrator's `TRANSIENT_RE` / `FATAL_RE` /
`PROVIDER_DOWN_RE` AND the friendly classifier all pattern-match these.
**Why:** changing the wording silently breaks retry eligibility and/or friendly
classification with no type error. Keep the strings byte-stable when refactoring.

## Honoring provider retry hints
`ReplicateError` carries `retryAfterMs` (from `Retry-After` header secs OR a
`retry_after` body field). `orchestrator.server.ts` `withRetry` uses it, capped at
`MAX_RETRY_AFTER_MS` (30s); otherwise falls back to fixed exponential backoff.
Retry *eligibility* is unchanged — still gated by `TRANSIENT_RE` (429/5xx/network).
The hint object propagates because the Replicate adapter `await`s `replicateRun`
without catching/rewrapping. Tests stay fast because fake clocks make setTimeout instant.
