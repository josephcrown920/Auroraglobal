-- Task #95 — periodic reconciliation for jobs left with an un-settled credit
-- reservation.
--
-- finalize_job (task #94) folds the terminal status write, generation write,
-- and credit commit/release into one transaction, so under normal operation a
-- job can never end up succeeded/failed with its reservation neither
-- committed nor released. This migration adds a self-healing safety net for
-- the cases that predate that fix (rows finished under the old three-step
-- flow) and for any future code path that marks a `jobs` row terminal without
-- going through finalize_job (e.g. a manual admin fix-up).
--
-- `credits_settled_at` is the marker: finalize_job now stamps it in the same
-- transaction as the commit/release it performs, so a NULL value on a
-- terminal job with a nonzero reservation is unambiguous evidence the
-- reservation was never resolved.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS credits_settled_at timestamptz;

-- Backfill: every job that finished before this column existed already went
-- through the (non-atomic, but normally-successful) commit/release call —
-- otherwise task #95 wouldn't be needed as a *rare* case. Mark them settled
-- as of their finish time so the reconciliation sweep only surfaces rows that
-- are genuinely unresolved going forward, not the entire historical backlog.
UPDATE public.jobs
   SET credits_settled_at = COALESCE(finished_at, created_at, now())
 WHERE status IN ('succeeded', 'failed')
   AND credits_settled_at IS NULL;

-- Narrow partial index: the reconciliation sweep only ever scans terminal
-- jobs with a live reservation that hasn't been marked settled.
CREATE INDEX IF NOT EXISTS jobs_unsettled_reservation_idx
  ON public.jobs (finished_at)
  WHERE status IN ('succeeded', 'failed')
    AND credits_reserved > 0
    AND credits_settled_at IS NULL;

-- finalize_job now stamps credits_settled_at whenever it runs a commit/release
-- (or, for a zero-reservation job, unconditionally — there's nothing to
-- reconcile either way). Re-created in full since this changes its body.
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

  UPDATE public.jobs
     SET status = _outcome,
         finished_at = now(),
         locked_at = NULL,
         locked_by = NULL,
         result = COALESCE(_result, result),
         error = COALESCE(_error, error),
         credits_settled_at = now()
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

REVOKE ALL ON FUNCTION public.finalize_job(uuid, text, text, jsonb, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_job(uuid, text, text, jsonb, text, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_job(uuid, text, text, jsonb, text, text, text, text) TO service_role;

-- Reconcile a single stuck job: CAS credits_settled_at from NULL to now() so
-- two concurrent sweeps (or a sweep racing a late/duplicate finalize_job call)
-- can never double-settle the same row, then commit or release its
-- reservation depending on the terminal status it already carries.
-- Idempotent — a job that no longer matches (already settled, or somehow no
-- longer terminal) is a silent no-op returning 'already_settled'.
CREATE OR REPLACE FUNCTION public.reconcile_stuck_reservation(_job uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.jobs;
BEGIN
  UPDATE public.jobs
     SET credits_settled_at = now()
   WHERE id = _job
     AND status IN ('succeeded', 'failed')
     AND credits_reserved > 0
     AND credits_settled_at IS NULL
  RETURNING * INTO _row;

  IF NOT FOUND THEN
    RETURN 'already_settled';
  END IF;

  IF _row.status = 'succeeded' THEN
    PERFORM public.commit_reservation(_row.user_id, _row.credits_reserved, 'reconcile_' || _row.kind, _row.id);
  ELSE
    PERFORM public.release_reservation(_row.user_id, _row.credits_reserved, 'reconcile_' || _row.kind, _row.id);
  END IF;

  RETURN 'reconciled';
END; $$;

REVOKE ALL ON FUNCTION public.reconcile_stuck_reservation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_stuck_reservation(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_stuck_reservation(uuid) TO service_role;
