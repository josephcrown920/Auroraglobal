-- Task #94 — fold job completion into one all-or-nothing transaction.
--
-- Previously the worker (processOneJob) finished a job via THREE separate
-- writes: finishJob() CAS'd the jobs row out of 'processing', markGeneration()
-- updated the linked generations row, and a commit_reservation/
-- release_reservation RPC settled the credit reservation. If the process
-- crashed (or the settlement RPC threw) between these steps, a job could end
-- up marked succeeded/failed while its reservation was never committed or
-- released — credits neither spent nor returned.
--
-- finalize_job folds the CAS, the generations write, and the credit
-- settlement into a single plpgsql function body. Postgres runs the whole
-- function in one transaction, so any error anywhere inside it rolls back
-- every write — the job/generation status and the credit ledger can never
-- diverge. It reuses commit_reservation/release_reservation as in-transaction
-- sub-calls rather than re-inlining the profiles math, so the ledger logic
-- stays single-sourced in one place.
--
-- The retry path is intentionally NOT routed through this RPC: a retry never
-- touches credits (the reservation stays held) and still needs the
-- JS-computed jittered backoff, so it keeps using the existing finishJob()
-- UPDATE — there is no credit-settlement race to close there.
CREATE OR REPLACE FUNCTION public.finalize_job(
  _job uuid,
  _worker text,
  _outcome text, -- 'succeeded' | 'failed'
  _result jsonb,
  _error text,
  _model text,
  _result_image_url text,
  _result_video_url text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.jobs;
BEGIN
  IF _outcome NOT IN ('succeeded', 'failed') THEN
    RAISE EXCEPTION 'finalize_job: invalid outcome %', _outcome;
  END IF;

  -- Fence on still owning the lock, exactly like the old finishJob(): if a
  -- stale-sweep already reclaimed this job (locked_by changed), this UPDATE
  -- matches no row and we must touch NOTHING else — the new owner is
  -- authoritative for the credit settlement and the generation write.
  UPDATE public.jobs
     SET status = _outcome,
         finished_at = now(),
         locked_at = NULL,
         locked_by = NULL,
         result = COALESCE(_result, result),
         error = COALESCE(_error, error)
   WHERE id = _job
     AND locked_by = _worker
     AND status = 'processing'
  RETURNING * INTO _row;

  IF NOT FOUND THEN
    RETURN 'stale';
  END IF;

  IF _row.generation_id IS NOT NULL THEN
    IF _outcome = 'succeeded' THEN
      UPDATE public.generations
         SET status = 'succeeded',
             model = COALESCE(_model, model),
             result_image_url = COALESCE(_result_image_url, result_image_url),
             result_video_url = COALESCE(_result_video_url, result_video_url)
       WHERE id = _row.generation_id;
    ELSE
      UPDATE public.generations
         SET status = 'failed',
             error = left(COALESCE(_error, ''), 1000)
       WHERE id = _row.generation_id;
    END IF;
  END IF;

  IF _row.credits_reserved > 0 THEN
    IF _outcome = 'succeeded' THEN
      PERFORM public.commit_reservation(_row.user_id, _row.credits_reserved, 'job_' || _row.kind, _row.id);
    ELSE
      PERFORM public.release_reservation(_row.user_id, _row.credits_reserved, 'job_' || _row.kind, _row.id);
    END IF;
  END IF;

  RETURN 'finalized';
END; $$;

-- Server-only, same hardening as every other job-finalization RPC: a
-- SECURITY DEFINER function is granted to PUBLIC by default, which over
-- PostgREST would let any anon/authenticated client force-finalize an
-- arbitrary job (settling someone else's credits).
REVOKE ALL ON FUNCTION public.finalize_job(uuid, text, text, jsonb, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_job(uuid, text, text, jsonb, text, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_job(uuid, text, text, jsonb, text, text, text, text) TO service_role;
