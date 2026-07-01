-- Task #153: extend heavy-queue auto-classification to 4K + multi-angle reshoot
-- Complements 20260702000000_heavy_queue.sql which only covered lipsync.
-- The trigger now also auto-classifies jobs whose payload indicates a 4K/2160p
-- resolution or whose kind is reshoot / multi_angle, matching classifyJobQueue()
-- in src/lib/billing.plans.ts so the TypeScript and DB layers stay in sync.

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

  -- Auto-classify heavy jobs when the application layer has not already done so.
  -- Criteria mirror classifyJobQueue() in src/lib/billing.plans.ts exactly:
  --   • lipsync kind
  --   • 4K / 2160p resolution (expensive provider tier)
  --   • reshoot / multi_angle kind (6-image burst)
  IF NEW.queue = 'standard' THEN
    IF NEW.kind IN ('lipsync', 'reshoot', 'multi_angle')
       OR (NEW.payload IS NOT NULL AND NEW.payload->>'kind' IN ('lipsync', 'reshoot', 'multi_angle'))
       OR (NEW.payload IS NOT NULL AND NEW.payload->>'resolution' IN ('4K', '2160p'))
    THEN
      NEW.queue := 'heavy';
    END IF;
  END IF;

  -- Heavy-queue jobs sort below every standard job (free baseline = 0).
  NEW.priority := _base - (CASE WHEN NEW.queue = 'heavy' THEN 20 ELSE 0 END);
  RETURN NEW;
END;
$$;
