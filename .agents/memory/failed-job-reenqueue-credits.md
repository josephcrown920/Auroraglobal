---
name: Re-enqueuing a failed job re-reserves credits
description: Why recovering a `failed` job must re-reserve fresh credits, not rely on a held reservation.
---

# Re-enqueuing a failed job re-reserves credits

When recovering a job that reached `status='failed'` (orphan-failure sweep / any
retry of a failed job), you MUST re-reserve fresh credits — NOT re-queue assuming
the reservation is still held.

**Why:** the terminal-failure path (both the current worker loop and the
pre-persistent-retry code) ALWAYS calls `release_reservation` when it marks a job
`failed`. So a `failed` job's credits are already refunded. Re-queuing it without
re-reserving would let the eventual success commit a reservation that no longer
exists (`commit_reservation` clamps `credits_reserved` at 0) → the render is
delivered FREE. Conversely, a job stuck in `processing` (stale-lock sweep) still
HOLDS its reservation, so that sweep just re-queues — do not conflate the two.

**How to apply:** do the re-reserve + flip-to-`queued` atomically in one
SECURITY-DEFINER RPC under a row lock (see `requeue_failed_job`): `SELECT ... FOR
UPDATE WHERE status='failed'`, `reserve_credits(...)`, then update — so concurrent
sweepers serialize (second sees not-`failed` → no-op) and a user who can't afford
it is left `failed` instead of running unpaid. Eligibility uses the same
`classifyJobError` transient/terminal gate + attempt/age bounds as the loop.
Note: every generation is created with a job via `create_generation_and_reserve`,
so there are no job-less failed generations — recovering failed jobs covers them.
