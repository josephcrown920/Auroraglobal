-- Atomic in_flight accounting for gpu_workers.
-- Previously the orchestrator did a JS read-modify-write (read row, write in_flight+1,
-- then in `finally` reset to the original snapshot). Under concurrent dispatch this drifts
-- (lost updates) and the count stops reflecting reality, hurting least-loaded routing.
-- These RPCs do the +1 / -1 in a single SQL statement so concurrent callers can't clobber
-- each other, and the decrement is floored at 0 so it never goes negative.

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
  RETURNING in_flight INTO _n;
  RETURN _n;
END; $$;

CREATE OR REPLACE FUNCTION public.gpu_worker_inflight_dec(_worker uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n integer;
BEGIN
  UPDATE public.gpu_workers
     SET in_flight = GREATEST(in_flight - 1, 0),
         last_heartbeat = now()
   WHERE id = _worker
  RETURNING in_flight INTO _n;
  RETURN _n;
END; $$;

-- Orchestrator runs as service_role; keep these off the public/auth surface.
REVOKE EXECUTE ON FUNCTION public.gpu_worker_inflight_inc(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gpu_worker_inflight_dec(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gpu_worker_inflight_inc(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.gpu_worker_inflight_dec(uuid) TO service_role;
