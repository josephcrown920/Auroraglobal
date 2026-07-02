-- Task #153: worker lanes — workers advertise which job queues they serve.
--
-- 1. gpu_workers.lanes: a self-hosted worker registers the lanes it is willing
--    to serve ('standard', 'heavy'). Default = both, so every existing row and
--    every legacy register call keeps its current behavior.
-- 2. claim_next_job_v2: lane-aware copy of claim_next_job — identical atomic
--    checkout (FOR UPDATE SKIP LOCKED) plus `queue = ANY(_lanes)`, so the
--    in-app runner can dedicate a batch slot to the heavy lane (heavy work
--    never starves under a flood of standard jobs) while standard slots are
--    never blocked behind heavy renders.
-- claim_next_job(text) stays in place untouched for rollback safety.

ALTER TABLE public.gpu_workers
  ADD COLUMN IF NOT EXISTS lanes text[] NOT NULL DEFAULT '{standard,heavy}';

CREATE OR REPLACE FUNCTION public.claim_next_job_v2(_worker text, _lanes text[])
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row public.jobs;
BEGIN
  WITH next AS (
    SELECT id FROM public.jobs
     WHERE status = 'queued'
       AND scheduled_at <= now()
       AND queue = ANY(_lanes)
     ORDER BY priority DESC, scheduled_at ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.jobs j
     SET status = 'processing',
         started_at = COALESCE(j.started_at, now()),
         locked_at = now(),
         locked_by = _worker,
         attempts = j.attempts + 1
    FROM next
   WHERE j.id = next.id
  RETURNING j.* INTO _row;
  RETURN _row;
END; $$;

-- Same lockdown as claim_next_job: service-role only.
REVOKE EXECUTE ON FUNCTION public.claim_next_job_v2(text, text[]) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.claim_next_job_v2(text, text[]) TO service_role;
