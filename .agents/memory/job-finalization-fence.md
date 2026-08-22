---
name: Job finalization ownership fence
description: Why worker job-finalization (and the stale-processing sweeper) must CAS on lock ownership to stay credit-safe.
---

# Job finalization must be ownership-fenced

The jobs worker claims a job (`claim_next_job` sets `status='processing'`,
`locked_by=<worker>`, `attempts++`, RETURNING the row), runs the pipeline, then
finalizes: commit reservation on success / release on terminal / requeue on
retry. A stale-processing sweeper re-queues jobs whose `locked_at` is older than
`STALE_PROCESSING_SECONDS`.

**The rule:** every finalization write — the job status transition AND the
generation update AND commit/release — must be gated on *winning a
compare-and-swap* guarded by `id = jobId AND locked_by = <thisWorker> AND
status = 'processing'`. `finishJob` does the transition as
`.update(...).eq("id").eq("locked_by", workerId).eq("status","processing").select("id")`
and returns `won = rows.length > 0`. Caller commits/releases/marks the generation
**only if won**.

**Why:** if a job legitimately runs longer than the stale threshold, the sweeper
re-queues it and a *second* worker reclaims it (changing `locked_by`). Without the
fence both workers finalize → double commit, double release, or one commits while
the other releases (charge + refund). Worse, gating only commit/release is NOT
enough: a late worker that wrote `markGeneration(succeeded, urls)` *before* the
CAS could expose a delivered render after the new owner already terminally
released (refunded) the job. So the success generation-write must be gated on
`won` too — not just the credit op.

**How to apply:** the in-memory `workerId` passed to `processOneJob` is a valid
fence token because `claim_next_job` sets `locked_by` to exactly that value. Order
each path as: CAS first (`finishJob`), then the side effects only if `won`. The
sweeper re-queue is then credit-safe regardless of threshold — residual cost of a
too-short threshold is only a duplicate provider call, never a credit error.

**Residuals (accepted, not bugs):** (1) a `commit_reservation` RPC failure after a
won success is logged and swallowed — never release there (that would refund a
delivered render); it can strand a reservation on a succeeded job (operational,
needs reconciliation). (2) a crash between winning the CAS and the generation
write leaves the job succeeded with the generation un-updated (durability window;
the job can't re-run). The fully-atomic fix is a single server-side finalize RPC
(CAS job + update generation + commit/release in one transaction).

**Security:** a `SECURITY DEFINER` recovery RPC (e.g. `reset_stale_processing_jobs`)
is EXECUTE-able by `PUBLIC` by default in Postgres → any anon/authenticated client
could trigger it via PostgREST. Always `REVOKE ALL ... FROM PUBLIC, anon,
authenticated` and `GRANT EXECUTE ... TO service_role`.

## Crash-loop give-up rule

**The rule:** stale-lock recovery must also enforce the persistent retry attempt
and age ceilings. A stale processing job beyond either limit must transition to
terminal failure, settle its reservation once, and stamp its settlement marker
atomically; only jobs below both limits may be re-queued.

**Why:** a process death bypasses the worker's in-process error handler. Without
the same ceiling in the stale sweep, a render can cycle claim → crash → stale
requeue forever while its Aura reservation remains held.

**How to apply:** derive the sweep limits from the canonical application policy,
pass them explicitly to recovery RPCs, and make the give-up UPDATE own the
stale processing row before it releases the reservation. Preserve default RPC
arguments only for compatibility with already-running callers, and test both
the attempt-based and age-based paths with rollback-safe database proofs.

