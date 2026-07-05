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
