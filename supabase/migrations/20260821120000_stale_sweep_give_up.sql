-- Task #345 — prevent stranded credits when async job workers crash mid-finalize.
--
-- The stale-processing sweep re-queues jobs whose worker died mid-run; the
-- reservation stays held and settles on the eventual finalize_job. But a job
-- whose worker CRASHES on every attempt (process death — never an in-process
-- error) never reaches the worker's retryDecision path, so the
-- persistent-retry attempt ceiling / age deadline was never enforced for it:
-- the job cycled sweep→re-queue→claim→crash forever with the user's Aura
-- held in credits_reserved — stranded credits.
--
-- Fix: teach the sweep itself to give up. A stale `processing` job that is
-- ALSO past the persistent-retry attempt ceiling or age deadline is
-- terminally failed and its reservation released — atomically, in the same
-- transaction — instead of being re-queued yet again.
--
-- Double-release safety (the fence this change is required to keep):
--   * The give-up UPDATE matches only rows still `status = 'processing'`
--     whose `locked_at` heartbeat is stale — a still-heartbeating worker's
--     job is never touched, no matter how many attempts it has.
--   * The release uses user_id / credits_reserved / kind RETURNED from the
--     exact row version the UPDATE flipped (Postgres re-checks the WHERE on
--     the current row under the row lock), so what we release is what that
--     row actually still held.
--   * A concurrent finalize_job blocks on the row lock, then fails its own
--     `locked_by = _worker AND status = 'processing'` fence and returns
--     'stale' — it can never settle the same reservation a second time.
--   * `credits_settled_at` is stamped in the same UPDATE, so the
--     reconcile_stuck_reservation sweep also treats the job as settled and
--     cannot double-release it.
--   * sweepFailedJobs cannot resurrect a given-up job: its eligibility
--     filter (attempts < ceiling AND created_at > age floor) excludes
--     exactly the rows this branch fails.
--
-- The two new parameters DEFAULT to the canonical policy values
-- (PERSISTENT_RETRY_MAX_ATTEMPTS = 48, PERSISTENT_RETRY_MAX_AGE = 48h in
-- seconds) purely as a backward-compat shim: an already-deployed server
-- calling the old 2-arg / 3-arg signature keeps working until it redeploys.
-- The TS sweepers always pass both explicitly — src/lib/jobs.server.ts
-- remains the source of truth for the policy numbers.

DROP FUNCTION IF EXISTS public.reset_stale_processing_jobs(int, int);

CREATE OR REPLACE FUNCTION public.reset_stale_processing_jobs(
  _max_age_seconds int,
  _backoff_seconds int,
  _give_up_attempts int DEFAULT 48,
  _give_up_age_seconds int DEFAULT 172800
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _r record;
  _ids uuid[];
  _requeued int;
  _gave_up int := 0;
BEGIN
  -- 1) Give up: stale AND past the retry ceiling/age → terminally fail the
  --    job and release its reservation, mirroring finalize_job's failed
  --    branch (status + generation + settlement in one transaction).
  FOR _r IN
    WITH gave_up AS (
      UPDATE public.jobs j
         SET status = 'failed',
             finished_at = now(),
             locked_at = NULL,
             locked_by = NULL,
             credits_settled_at = now(),
             error = 'stale_worker_lock_gave_up'
       WHERE j.status = 'processing'
         AND j.locked_at IS NOT NULL
         AND j.locked_at < now() - make_interval(secs => GREATEST(_max_age_seconds, 1))
         AND (
           j.attempts >= _give_up_attempts
           OR j.created_at < now() - make_interval(secs => GREATEST(_give_up_age_seconds, 1))
         )
      RETURNING j.id, j.user_id, j.kind, j.credits_reserved, j.generation_id
    )
    SELECT * FROM gave_up
  LOOP
    IF _r.credits_reserved > 0 THEN
      PERFORM public.release_reservation(_r.user_id, _r.credits_reserved, 'job_' || _r.kind, _r.id);
    END IF;
    IF _r.generation_id IS NOT NULL THEN
      UPDATE public.generations
         SET status = 'failed',
             error = 'Render failed after repeated worker crashes — your Aura was refunded.'
       WHERE id = _r.generation_id;
    END IF;
    _gave_up := _gave_up + 1;
  END LOOP;

  -- 2) Re-queue the remaining stale jobs (reservation stays held; the
  --    eventual finalize_job settles it). Runs AFTER the give-up UPDATE in
  --    the same transaction, so a given-up row (no longer 'processing') can
  --    never also be re-queued.
  WITH stale AS (
    UPDATE public.jobs j
       SET status = 'queued',
           locked_at = NULL,
           locked_by = NULL,
           scheduled_at = now() + make_interval(secs => GREATEST(_backoff_seconds, 0)),
           error = 'stale_worker_lock'
     WHERE j.status = 'processing'
       AND j.locked_at IS NOT NULL
       AND j.locked_at < now() - make_interval(secs => GREATEST(_max_age_seconds, 1))
    RETURNING j.generation_id
  )
  SELECT count(*)::int,
         array_agg(generation_id) FILTER (WHERE generation_id IS NOT NULL)
    INTO _requeued, _ids
    FROM stale;

  IF _ids IS NOT NULL AND array_length(_ids, 1) > 0 THEN
    UPDATE public.generations
       SET status = 'pending'
     WHERE id = ANY(_ids)
       AND status IN ('processing', 'pending', 'retrying');
  END IF;

  RETURN COALESCE(_requeued, 0) + _gave_up;
END; $$;

-- Same hardening as before: SECURITY DEFINER + default PUBLIC EXECUTE would
-- let any anon/authenticated client force stale resets (and now forced
-- give-up releases) via PostgREST. Server (service_role) only.
REVOKE ALL ON FUNCTION public.reset_stale_processing_jobs(int, int, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_stale_processing_jobs(int, int, int, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_stale_processing_jobs(int, int, int, int) TO service_role;

-- ── Kind-scoped companion sweep (motion / performance_reskin) — identical
--    give-up semantics, additionally filtered on kind. ─────────────────────

DROP FUNCTION IF EXISTS public.reset_stale_processing_jobs_for_kinds(text[], int, int);

CREATE OR REPLACE FUNCTION public.reset_stale_processing_jobs_for_kinds(
  _kinds text[],
  _max_age_seconds int,
  _backoff_seconds int,
  _give_up_attempts int DEFAULT 48,
  _give_up_age_seconds int DEFAULT 172800
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _r record;
  _ids uuid[];
  _requeued int;
  _gave_up int := 0;
BEGIN
  FOR _r IN
    WITH gave_up AS (
      UPDATE public.jobs j
         SET status = 'failed',
             finished_at = now(),
             locked_at = NULL,
             locked_by = NULL,
             credits_settled_at = now(),
             error = 'stale_worker_lock_gave_up'
       WHERE j.status = 'processing'
         AND j.kind = ANY(_kinds)
         AND j.locked_at IS NOT NULL
         AND j.locked_at < now() - make_interval(secs => GREATEST(_max_age_seconds, 1))
         AND (
           j.attempts >= _give_up_attempts
           OR j.created_at < now() - make_interval(secs => GREATEST(_give_up_age_seconds, 1))
         )
      RETURNING j.id, j.user_id, j.kind, j.credits_reserved, j.generation_id
    )
    SELECT * FROM gave_up
  LOOP
    IF _r.credits_reserved > 0 THEN
      PERFORM public.release_reservation(_r.user_id, _r.credits_reserved, 'job_' || _r.kind, _r.id);
    END IF;
    IF _r.generation_id IS NOT NULL THEN
      UPDATE public.generations
         SET status = 'failed',
             error = 'Render failed after repeated worker crashes — your Aura was refunded.'
       WHERE id = _r.generation_id;
    END IF;
    _gave_up := _gave_up + 1;
  END LOOP;

  WITH stale AS (
    UPDATE public.jobs j
       SET status = 'queued',
           locked_at = NULL,
           locked_by = NULL,
           scheduled_at = now() + make_interval(secs => GREATEST(_backoff_seconds, 0)),
           error = 'stale_worker_lock'
     WHERE j.status = 'processing'
       AND j.kind = ANY(_kinds)
       AND j.locked_at IS NOT NULL
       AND j.locked_at < now() - make_interval(secs => GREATEST(_max_age_seconds, 1))
    RETURNING j.generation_id
  )
  SELECT count(*)::int,
         array_agg(generation_id) FILTER (WHERE generation_id IS NOT NULL)
    INTO _requeued, _ids
    FROM stale;

  IF _ids IS NOT NULL AND array_length(_ids, 1) > 0 THEN
    UPDATE public.generations
       SET status = 'pending'
     WHERE id = ANY(_ids)
       AND status IN ('processing', 'pending', 'retrying');
  END IF;

  RETURN COALESCE(_requeued, 0) + _gave_up;
END; $$;

REVOKE ALL ON FUNCTION public.reset_stale_processing_jobs_for_kinds(text[], int, int, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_stale_processing_jobs_for_kinds(text[], int, int, int, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_stale_processing_jobs_for_kinds(text[], int, int, int, int) TO service_role;
