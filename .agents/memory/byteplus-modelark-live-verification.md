---
name: BytePlus/ModelArk live verification findings
description: Distinguish catalog visibility, regional credentials, model activation, quota, and actual completed generation.
---

## Catalog access is not render readiness

Check authentication, model identity, account entitlement, and completed output
separately. A successful catalog response does not certify generation.

**Why:** ModelArk can list a model even when generation is blocked by account
billing. Parameter validation can also precede entitlement checks, so an invalid
request reaching validation is not proof that a valid render will succeed.

**How to apply:** Report metadata checks as metadata only. Do not automatically
retry ambiguous paid submissions. Keep native rollout gates closed until scoped
permissions checks and an approved real render succeed.

## Region and error distinctions

Keep the verified Southeast Asia BytePlus host unless there is contrary evidence.
Distinguish `ModelNotOpen` from `InvalidEndpointOrModel.NotFound`.

**Why:** A BytePlus-issued key rejected by the mainland Volcano host is not
necessarily invalid. `ModelNotOpen` identifies missing account activation;
`NotFound` can instead identify a retired or incorrect model ID.

**How to apply:** Verify host and credential separately, then consult the
paginated models catalog before changing a dated model mapping. Route
account-activation and billing failures to account repair rather than inventing
replacement slugs.

## Verify compatible fallback models

Do not assume a new native model has an equivalent fal or Replicate endpoint.

**Why:** Catalog additions have preceded verified alternate-provider slugs.
Guessing an endpoint can silently substitute a different model or lose reference
inputs and approved controls.

**How to apply:** Keep rich native requests pinned until a backup has verified
capability parity; follow the hybrid-agent fallback policy for approvals and
actual-engine disclosure.