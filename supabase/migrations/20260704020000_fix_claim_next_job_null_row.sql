-- Bugfix: claim_next_job / claim_next_job_v2 return `public.jobs` (a single
-- composite row). When the queue is empty, PL/pgSQL's `_row public.jobs` stays
-- an unassigned (SQL NULL) composite, but PostgREST/to_json serializes a NULL
-- composite of a known type as an object with every column set to `null`
-- (`{"id":null,"kind":null,...}`), NOT a JSON `null`. supabase-js therefore
-- returns a truthy object even when nothing was claimed, so `if (!row) return
-- null` in claimNext() never fires — the worker loop proceeds to "process" a
-- phantom job with a null payload and crashes reading `.kind`/`.id` off null.
-- This explains every observed `/api/public/jobs/tick` "stale" result with
-- jobId: null and "Cannot read properties of null (reading 'kind')".
--
-- Fix: switch both RPCs to `RETURNS SETOF public.jobs` and `RETURN QUERY`, so
-- an empty queue yields a genuinely empty result set (`[]` over PostgREST),
-- which claimNext() already handles via `Array.isArray(row) ? (row[0] ??
-- null) : row`. Return type changes require DROP + CREATE (CREATE OR REPLACE
-- cannot change a function's return type).

DROP FUNCTION IF EXISTS public.claim_next_job(text);

CREATE FUNCTION public.claim_next_job(_worker text)
RETURNS SETOF public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH next AS (
    SELECT id FROM public.jobs
     WHERE status = 'queued'
       AND scheduled_at <= now()
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
  RETURNING j.*;
END; $$;

REVOKE EXECUTE ON FUNCTION public.claim_next_job(text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.claim_next_job(text) TO service_role;

DROP FUNCTION IF EXISTS public.claim_next_job_v2(text, text[]);

CREATE FUNCTION public.claim_next_job_v2(_worker text, _lanes text[])
RETURNS SETOF public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
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
  RETURNING j.*;
END; $$;

REVOKE EXECUTE ON FUNCTION public.claim_next_job_v2(text, text[]) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.claim_next_job_v2(text, text[]) TO service_role;
