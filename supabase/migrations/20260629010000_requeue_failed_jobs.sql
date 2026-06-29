-- Task #87 — orphan-failure recovery.
-- Re-enqueue a single job that ended up `failed` (with a transient error, still
-- within the persistent-retry bounds) so generations that fell out of the active
-- queue keep getting retried instead of staying dead. The JS sweeper
-- (sweepFailedJobs) decides eligibility using the same terminal/transient
-- classifier as the worker loop, then calls this RPC per candidate.
--
-- Credit safety: the terminal-failure path ALWAYS released a failed job's
-- reservation, so re-running it means re-reserving fresh credits. This is done
-- atomically here under a row lock: if the user can no longer afford the job we
-- return 'insufficient_credits' and leave it failed (never thrash, never run a
-- job without a reservation). Concurrent sweepers serialize on the FOR UPDATE
-- lock — the second caller sees status != 'failed' and returns 'not_found', so a
-- job is never re-reserved twice.
CREATE OR REPLACE FUNCTION public.requeue_failed_job(_job uuid, _backoff_seconds int)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.jobs;
  _ok boolean;
BEGIN
  SELECT * INTO _row FROM public.jobs WHERE id = _job AND status = 'failed' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  -- Re-reserve the original amount (the failure already refunded it). Zero-cost
  -- (admin/free) jobs skip the reserve entirely.
  IF _row.credits_reserved > 0 THEN
    _ok := public.reserve_credits(_row.user_id, _row.credits_reserved, 'job_' || _row.kind, _row.id);
    IF NOT _ok THEN
      RETURN 'insufficient_credits';
    END IF;
  END IF;

  UPDATE public.jobs
     SET status = 'queued',
         scheduled_at = now() + make_interval(secs => GREATEST(_backoff_seconds, 0)),
         locked_at = NULL,
         locked_by = NULL,
         finished_at = NULL
   WHERE id = _row.id;

  IF _row.generation_id IS NOT NULL THEN
    UPDATE public.generations
       SET status = 'retrying'
     WHERE id = _row.generation_id;
  END IF;

  RETURN 'requeued';
END; $$;

-- Server-only (same hardening as reset_stale_processing_jobs): a SECURITY DEFINER
-- function is granted to PUBLIC by default, which over PostgREST would let any
-- anon/authenticated client force a re-reserve + re-queue on arbitrary job ids.
REVOKE ALL ON FUNCTION public.requeue_failed_job(uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.requeue_failed_job(uuid, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_failed_job(uuid, int) TO service_role;

-- Index for the failed-orphan scan (status + age + attempts ordering).
CREATE INDEX IF NOT EXISTS jobs_failed_recover_idx
  ON public.jobs (created_at)
  WHERE status = 'failed';
