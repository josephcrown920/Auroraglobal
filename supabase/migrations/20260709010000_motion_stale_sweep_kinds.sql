-- Task: prevent silent credit loss if a motion/performance_reskin job never
-- reaches a worker. Motion Transfer (30 Aura) and Performance Shot (48 Aura)
-- are now high enough value that waiting out the full 15-minute global stale
-- sweep window is a real cost to a user whose job never got ACKed. Add a
-- kind-scoped sweep with a tighter window, called BEFORE the global sweep so
-- these two kinds get reclaimed fast without shortening the safe window for
-- every other job kind (which could reclaim slow-but-healthy long renders).
CREATE OR REPLACE FUNCTION public.reset_stale_processing_jobs_for_kinds(
  _kinds text[],
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
       AND j.kind = ANY(_kinds)
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

REVOKE ALL ON FUNCTION public.reset_stale_processing_jobs_for_kinds(text[], int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_stale_processing_jobs_for_kinds(text[], int, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_stale_processing_jobs_for_kinds(text[], int, int) TO service_role;
