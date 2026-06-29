-- Task #87 — persistent retry of failed generations.
-- Adds: (1) a scheduler heartbeat table so a stalled cron is observable,
-- (2) an atomic RPC that recovers jobs stuck in `processing` because the worker
--     instance died mid-run (real orphan source under request-driven autoscale),
-- (3) a partial index supporting the stale-lock sweep.
-- No pg_cron is created here — recurring scheduling is configured in the Supabase
-- dashboard (see README "Scheduling the worker tick").

-- 1. Scheduler heartbeat (one row per named scheduled job, e.g. 'jobs_tick')
CREATE TABLE IF NOT EXISTS public.scheduler_heartbeats (
  name text PRIMARY KEY,
  last_run_at timestamptz,
  last_ok_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.scheduler_heartbeats TO authenticated;
GRANT ALL ON public.scheduler_heartbeats TO service_role;

ALTER TABLE public.scheduler_heartbeats ENABLE ROW LEVEL SECURITY;
-- Service-role writes (bypasses RLS); no authenticated client writes. Admin reads
-- go through a SECURITY-checked server fn using the service-role key, so no public
-- SELECT policy is exposed here.

-- 2. Recover stale `processing` jobs whose worker died mid-run. These jobs never
-- committed or released their reservation, so re-queuing them is credit-safe (the
-- reservation is still held and will be committed on the eventual success, or
-- released once the persistent-retry ceiling/age is hit). Returns the count reset.
CREATE OR REPLACE FUNCTION public.reset_stale_processing_jobs(
  _max_age_seconds int,
  _backoff_seconds int
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ids uuid[];
  _count int;
BEGIN
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
    INTO _count, _ids
    FROM stale;

  IF _ids IS NOT NULL AND array_length(_ids, 1) > 0 THEN
    UPDATE public.generations
       SET status = 'pending'
     WHERE id = ANY(_ids)
       AND status IN ('processing', 'pending', 'retrying');
  END IF;

  RETURN COALESCE(_count, 0);
END; $$;

-- Lock the sweep down to the server (service_role) only. Postgres grants EXECUTE
-- on new functions to PUBLIC by default, which — combined with SECURITY DEFINER —
-- would let any anon/authenticated client force stale resets (e.g. _max_age=1)
-- via PostgREST. Recurring scheduling calls this with the service-role key.
REVOKE ALL ON FUNCTION public.reset_stale_processing_jobs(int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_stale_processing_jobs(int, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_stale_processing_jobs(int, int) TO service_role;

-- 3. Index for the stale-lock scan.
CREATE INDEX IF NOT EXISTS jobs_processing_lock_idx
  ON public.jobs (locked_at)
  WHERE status = 'processing';
