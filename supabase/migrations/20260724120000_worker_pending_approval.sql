-- Add 'pending_approval' status for community GPU worker registrations.
--
-- Before this migration the status column was an unconstrained text field
-- defaulting to 'active'. Community/external operators should land in
-- 'pending_approval' on first registration and only start receiving jobs after
-- the owner explicitly approves them from Admin → Workers. This migration
-- formalises the valid values with a check constraint (safe: all existing rows
-- already carry one of the three approved values) and documents the semantics.

ALTER TABLE public.gpu_workers
  ADD CONSTRAINT gpu_workers_status_check
  CHECK (status IN ('active', 'paused', 'draining', 'pending_approval'));

COMMENT ON COLUMN public.gpu_workers.status IS
  'active = serving jobs normally; '
  'paused = admin halted (no new jobs dispatched); '
  'draining = finishing in-flight jobs then halting; '
  'pending_approval = newly self-registered worker awaiting admin review before '
  'it can receive any job payload. The dispatcher exclusively queries status = ''active'', '
  'so pending_approval workers are automatically excluded from routing.';

-- The reserve_job worker-selection query already uses status = 'active', so
-- pending_approval workers are automatically excluded from job dispatch with no
-- changes required to the orchestrator.
