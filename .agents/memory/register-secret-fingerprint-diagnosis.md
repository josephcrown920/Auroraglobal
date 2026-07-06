---
name: Register-secret 401 fingerprint diagnosis
description: How a Kaggle/Colab/Vast worker's AURORA_REGISTER_SECRET mismatch is diagnosed without ever exposing the raw secret
---

A `[register] failed 401` from a self-registering worker is caused by a **value
mismatch** between the worker's `AURORA_REGISTER_SECRET` and Aurora's own env var of
the same name — both sides' code is typically already correct, the values just don't
match (usually because they were generated/typed independently instead of one value
copied to both places). There is deliberately no UI to view/copy the currently
configured secret.

**How to apply:** compare one-way SHA-256 fingerprints (8 hex chars) instead of the
raw value — never log or expose the secret itself. `src/routes/api/public/workers/register.ts`
logs `received fp:X expected fp:Y` into `worker_register_attempts.error` on a mismatch
(both sides also `.trim()`ed defensively for whitespace/newline mismatches). The shared
`register_with_aurora()` in `workers/aurora_worker.py` (reused by Kaggle/Colab/Vast
templates) prints its own fingerprint before attempting to register, so the operator
can visually diff it against Admin → Workers → Recent registration attempts.
