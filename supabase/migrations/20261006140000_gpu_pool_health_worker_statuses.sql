-- Align GPU pool reporting with the worker lifecycle statuses.
CREATE OR REPLACE VIEW public.gpu_pool_health AS
SELECT
  count(*) FILTER (WHERE status IN ('active','paused','draining','pending_approval'))::int AS configured_workers,
  count(*) FILTER (WHERE status = 'active')::int AS healthy_workers,
  count(*) FILTER (WHERE status = 'draining')::int AS degraded_workers,
  count(*) FILTER (WHERE status IN ('paused','draining','pending_approval'))::int AS unavailable_workers,
  coalesce(sum(in_flight), 0)::int AS in_flight,
  coalesce(sum(max_concurrency), 0)::int AS max_concurrency,
  CASE WHEN coalesce(sum(max_concurrency),0) > 0
    THEN round((coalesce(sum(in_flight),0)::numeric / sum(max_concurrency)::numeric) * 100, 2)
    ELSE 0 END AS utilization_pct,
  CASE WHEN count(*) FILTER (WHERE status IN ('active','paused','draining','pending_approval')) > 0
    THEN round((count(*) FILTER (WHERE status = 'active')::numeric / count(*) FILTER (WHERE status IN ('active','paused','draining','pending_approval'))::numeric) * 100, 2)
    ELSE 0 END AS healthy_pct,
  min(last_heartbeat) FILTER (WHERE status = 'active') AS oldest_healthy_heartbeat,
  max(last_probe_at) AS last_probe_at
FROM public.gpu_workers;

GRANT SELECT ON public.gpu_pool_health TO authenticated, service_role;

COMMENT ON VIEW public.gpu_pool_health IS
  'Derived GPU pool health: healthy/degraded/unavailable worker counts, aggregate capacity, utilization, healthy percentage, and probe freshness.';
