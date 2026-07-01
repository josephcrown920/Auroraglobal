-- Task #153: cost control guardrails — heavy job queue
-- Adds a `queue` column to jobs (default 'standard') and updates the
-- set_job_priority_from_plan trigger so heavy-queue jobs always sort BELOW
-- standard free-tier work. No changes to claim_next_job are required: it already
-- orders by priority DESC, scheduled_at ASC, so heavy jobs float to the bottom.
--
-- Priority grid after this migration:
--   Standard + Pro  →  +10    Standard + Free  →   0
--   Heavy    + Pro  →  −10    Heavy    + Free  →  −20
--
-- Heavy kinds are auto-classified by the trigger (lipsync) so no changes are
-- needed to the create_generation_and_reserve RPC.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS queue text NOT NULL DEFAULT 'standard';

-- Partial index supporting heavy-queue-aware scheduling scans.
CREATE INDEX IF NOT EXISTS jobs_heavy_queue_idx
  ON public.jobs (priority DESC, scheduled_at)
  WHERE status = 'queued' AND queue = 'heavy';

-- ─── Recreate the priority trigger ──────────────────────────────────────────
-- Now also:
-- 1. Auto-classifies lipsync jobs (and any other HEAVY_KINDS) as heavy queue.
-- 2. Subtracts 20 from the priority of heavy-queue jobs so they always trail
--    standard work without requiring a separate worker lane or RPC change.
CREATE OR REPLACE FUNCTION public.set_job_priority_from_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _base int;
BEGIN
  _base := COALESCE((
    SELECT CASE
      WHEN p.plan = 'pro' THEN 10
      WHEN EXISTS(
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = NEW.user_id AND ur.role = 'admin'
      ) THEN 10
      ELSE 0
    END
    FROM public.profiles p
    WHERE p.user_id = NEW.user_id
    LIMIT 1
  ), 0);

  -- Auto-classify kinds that are always heavy (expensive, non-urgent).
  -- Respects an explicit queue value already set by the application layer.
  IF NEW.queue = 'standard' THEN
    IF NEW.kind IN ('lipsync') OR
       (NEW.payload IS NOT NULL AND NEW.payload->>'kind' IN ('lipsync')) THEN
      NEW.queue := 'heavy';
    END IF;
  END IF;

  -- Heavy-queue jobs sort below every standard job (free baseline = 0),
  -- so a lipsync render never delays a quick image generation.
  NEW.priority := _base - (CASE WHEN NEW.queue = 'heavy' THEN 20 ELSE 0 END);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_priority_from_plan ON public.jobs;
CREATE TRIGGER job_priority_from_plan
  BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_job_priority_from_plan();
