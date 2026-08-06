---
name: BytePlus/ModelArk live verification findings
description: How to distinguish a wrong model slug from an unactivated one on ModelArk, and how orchestrator fallback behaves for each.
---

Verified 2026-07-04 against the live BytePlus ModelArk API (`ark.ap-southeast.bytepluses.com`) with a real `BYTEPLUS_API_KEY`.

- The base URL/region default (`ap-southeast`) is correct for a BytePlus-issued key — the Volcano China host (`ark.cn-beijing.volces.com`) 401s ("API key doesn't exist") with the same key. Don't swap the default without evidence.
- `GET /api/v3/models` (paginated) returns the full ModelArk catalog including a `status` field (`"Retiring"`/`"Shutdown"` when present, absent when live). Use it to check whether a dated model-ID suffix is still current before trusting a mapping.
- Two different 404 shapes mean different things — don't treat them the same:
  - `ModelNotOpen` ("has not activated the model... activate in the Ark Console") = the slug is correct and current, but this *account* hasn't turned the model on. This is an account/billing action, not a code fix.
  - `InvalidEndpointOrModel.NotFound` = the slug itself is gone/wrong (e.g. a retired dated suffix). This IS a code fix — swap to the current replacement slug from the catalog.
- Neither 404 shape matches orchestrator.server.ts's `FATAL_RE` or `PROVIDER_DOWN_RE`, so both correctly fall through to the next adapter (Replicate/fal) for the same model on a real failure, matching the mocked-fallback unit tests — confirmed by reading the regexes, not just running the mocks.
- Re-verified 2026-07-05: the catalog gains new dated Seed checkpoints over time (e.g. seedream-4-5, seedream-5-0, seedance-1-5-pro all went live between the 07-04 and 07-05 pulls). Re-pull `GET /api/v3/models` periodically rather than assuming last session's snapshot is current — a mapping that reused an older sibling's model ID (e.g. seedream-4.5 aliasing seedream-4.0's ID before 4.5 existed) needs updating once the real checkpoint appears.
- A brand-new Seed model with no verified Replicate/fal slug yet must be BytePlus-only: add it to `BYTEPLUS_DEFAULTS` + a hand-written `MODEL_REGISTRY` entry (it won't auto-populate from `REPLICATE_MAP`), but do NOT invent a guessed Replicate slug — that would silently violate the "no unverifiable marketing SKUs" rule and could route to a wrong/nonexistent model on fallback.

## Re-verification 2026-08-06 (account 3003324153)

All Seed model slugs in BYTEPLUS_DEFAULTS are confirmed **present in the ModelArk catalog** (status='' = live, not Retiring/Shutdown) but **none are activated** on account 3003324153 — every live call returns `ModelNotOpen`. Generation still falls through to Replicate/fal correctly.

**Updated slug mappings** (via catalog pull 2026-08-06):
- `seedance-2.0` app key → changed from `seedance-1-0-pro-250528` to `dreamina-seedance-2-0-260128` (the real ByteDance "Seedance 2.0" branded checkpoint, Jan 2026).
- `seedance-2.0-fast` app key → changed from `seedance-1-0-pro-fast-251015` to `dreamina-seedance-2-0-fast-260128` (Jan 2026 fast tier).

**New catalog entries confirmed ModelNotOpen (not dead):**
- `dreamina-seedance-2-0-mini-260615` — a new "mini" tier not yet in BYTEPLUS_DEFAULTS.
- `dola-seedream-5-0-pro-260628` — Seedream 5 Pro not yet in BYTEPLUS_DEFAULTS.

**What the account owner still needs to do** (in BytePlus Ark Console):
- Activate `seedream-4-0-250828` (Seedream 4.0 image)
- Activate `seedream-4-5-251128` (Seedream 4.5 image)
- Activate `seedream-5-0-260128` (Seedream 5 image)
- Activate `dreamina-seedance-2-0-260128` (Seedance 2.0 video — updated slug)
- Activate `dreamina-seedance-2-0-fast-260128` (Seedance 2.0 Fast video — updated slug)
- Activate `seedance-1-5-pro-251215` (Seedance 3.0 video)
- Activate `dreamina-seedance-2-5-260628` (Seedance 2.5 video)
- Optionally: `dreamina-seedance-2-0-mini-260615` and `dola-seedream-5-0-pro-260628` for new tiers.

Once activated, re-run: `curl -X POST https://ark.ap-southeast.bytepluses.com/api/v3/images/generations -H "Authorization: Bearer $BYTEPLUS_API_KEY" -H "Content-Type: application/json" -d '{"model":"seedream-4-0-250828","prompt":"a red apple","size":"512x512","response_format":"url","watermark":false}'` — should return `{"data":[{"url":"..."}]}` not a `ModelNotOpen` error.
