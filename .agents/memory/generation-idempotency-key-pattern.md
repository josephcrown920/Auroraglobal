---
name: Generation idempotency-key pattern
description: How reserveOrchestrateRecord's optional idempotencyKey claim/replay/reject/retry state machine is designed, for consistency in future idempotency work.
---

`reserveOrchestrateRecord` takes an **optional** `idempotencyKey`. Existing internal callers omit it and are unaffected — this keeps a safety-critical change purely additive.

Backed by a dedicated `generation_idempotency_keys` table (not reused from `generations`), because a real "claim" needs a persisted `pending` row to fence concurrent/duplicate requests before the expensive work starts.

State machine on `(user, idempotencyKey)`:
- No row yet → claim it (`pending`), do the real charge/render, then record the outcome.
- Row `succeeded` → replay the stored response, no new charge.
- Row `pending` (another request already claimed it) → reject as a conflict (409), never double-run.
- Row `failed` → retry is allowed (re-reserve fresh credits), capped at 2 attempts total.

**Why the asymmetric error handling matters:** a failed *write* that was recording a *successful* outcome is swallowed and logged — the successful result is still returned to the caller, since losing the "succeeded" marker only risks a harmless future replay-miss. A failed *write* recording a *failed* outcome is NOT swallowed — it's combined with the original error and re-thrown, because silently losing a "failed" marker could leave a claimed key stuck in limbo (looking `pending` forever) or, worse, strand a reservation with no record to reconcile against.

**How to apply:** any new idempotency-guarded mutation should reuse this same claim/replay/reject/retry shape and the same swallow-on-success-write-failure / throw-on-failure-write-failure asymmetry, rather than inventing a new variant per feature.
