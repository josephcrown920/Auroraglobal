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
