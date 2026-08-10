---
name: Vast.ai API contract quirks
description: Live-verified wire-format rules for console.vast.ai/api/v0 — search method, offer-by-id filter, env format, price semantics, 2FA key requirement.
---

# Vast.ai API contract (live-verified 2026-08-10)

- Offer search is **POST /bundles/** — PUT returns HTML 404.
- Filtering offers by `id: {eq}` silently returns 0 results; use
  `ask_contract_id: {eq}` to re-fetch a specific offer.
- Create-instance `env` must be a single **Docker-flags string**
  (`-e KEY='value' -p 8000:8000`), never a JSON object; single-quote values and
  escape embedded quotes (`buildEnvString` in vast-api.server.ts).
- The `price` field on create applies only to **interruptible/bid** instances —
  it is NOT an on-demand max-price cap. Enforce on-demand ceilings by
  re-fetching the offer immediately before create and rejecting over-ceiling.
- Instance operations (list/create/stop/destroy) return 401 "requires Two
  Factor Authentication" unless the API key was created **after** enabling 2FA
  on the Vast account; offer search works with a pre-2FA key. Account-level,
  not a code bug.

**How to apply:** any new Vast endpoint work must be live-probed with curl
before trusting docs or memory of the CLI's behavior; the unit tests assert
these wire shapes in src/lib/vast-api.test.ts.
