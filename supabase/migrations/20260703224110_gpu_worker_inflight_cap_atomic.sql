-- Make the capacity guard atomic with the increment.
--
-- Previously gpu_worker_inflight_inc unconditionally incremented in_flight, and the
-- orchestrator did a separate JS read of `in_flight >= max_concurrency` *before*
-- calling it. Under concurrent dispatch two requests could both observe a free slot
-- (read-check-then-act race) and both increment, oversubscribing the worker past
-- max_concurrency.
--
-- Fix: fold the capacity check into the same UPDATE statement. The row is only
-- updated (and in_flight only incremented) when in_flight < max_concurrency, all in
-- one atomic write. If the guard fails, no row matches and the RPC returns NULL —
-- the caller (orchestrator) must treat NULL as "worker full, skip to next candidate".

CREATE OR REPLACE FUNCTION public.gpu_worker_inflight_inc(_worker uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n integer;
BEGIN
  UPDATE public.gpu_workers
     SET in_flight = in_flight + 1
   WHERE id = _worker
     AND in_flight < max_concurrency
  RETURNING in_flight INTO _n;
  RETURN _n; -- NULL when the worker doesn't exist or is already at capacity
END; $$;

-- Grants unchanged (service_role only); re-stated for idempotency of this migration.
REVOKE EXECUTE ON FUNCTION public.gpu_worker_inflight_inc(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gpu_worker_inflight_inc(uuid) TO service_role;
