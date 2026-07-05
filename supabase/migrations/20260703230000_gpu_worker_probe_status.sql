-- Surface worker health-probe results for the admin dashboard: when a worker
-- was last probed, whether that probe succeeded, and why it's paused (the
-- automatic health sweep vs an admin clicking Pause). Backward compatible —
-- existing rows get NULL probe fields (never probed yet) and NULL
-- paused_reason (unknown/legacy pause).

ALTER TABLE public.gpu_workers
  ADD COLUMN IF NOT EXISTS last_probe_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_probe_ok boolean,
  ADD COLUMN IF NOT EXISTS last_probe_detail text,
  ADD COLUMN IF NOT EXISTS last_probe_error text,
  ADD COLUMN IF NOT EXISTS paused_reason text;

COMMENT ON COLUMN public.gpu_workers.last_probe_at IS
  'Timestamp of the most recent health probe (manual Ping or the automatic sweep in checkGPUWorkerHealth), regardless of outcome.';
COMMENT ON COLUMN public.gpu_workers.last_probe_ok IS
  'Result of the most recent health probe: true = healthy/reachable, false = unhealthy or unreachable, NULL = never probed.';
COMMENT ON COLUMN public.gpu_workers.last_probe_detail IS
  'Human-readable extra info from the last probe (e.g. RunPod ready/unhealthy worker counts).';
COMMENT ON COLUMN public.gpu_workers.last_probe_error IS
  'Error message from the last probe when it failed or was unreachable; NULL when the last probe succeeded.';
COMMENT ON COLUMN public.gpu_workers.paused_reason IS
  'Why a paused/draining worker is in that state: ''auto'' = the health sweep paused it after a failed probe, ''admin'' = an admin explicitly paused/drained it. NULL when active or for legacy pauses predating this column.';
