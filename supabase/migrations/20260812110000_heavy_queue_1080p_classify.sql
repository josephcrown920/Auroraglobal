-- Task #286: sync DB trigger with classifyJobQueue() — add 1080p to heavy set
--
-- classifyJobQueue() in src/lib/billing.plans.ts classifies 1080p (HD) renders
-- as heavy because they are significantly more expensive than 720p/480p and can
-- run for many minutes on a video provider. The DB trigger
-- set_job_priority_from_plan only covered '4K' and '2160p', causing a drift:
-- a 1080p video job would land in the standard queue (priority 0 for free-tier)
-- instead of the heavy queue (priority -20), potentially blocking standard image
-- renders. This migration brings the trigger into sync with the TS helper.
--
-- The existing partial index on (queue = 'heavy') covers the new rows; no
-- additional index change is needed.

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
  --   • HD (1080p) / 4K (2160p) resolution (expensive provider tier)
  --   • reshoot / multi_angle kind (6-image burst)
  IF NEW.queue = 'standard' THEN
    IF NEW.kind IN ('lipsync', 'reshoot', 'multi_angle')
       OR (NEW.payload IS NOT NULL AND NEW.payload->>'kind' IN ('lipsync', 'reshoot', 'multi_angle'))
       OR (NEW.payload IS NOT NULL AND NEW.payload->>'resolution' IN ('1080p', '4K', '2160p'))
    THEN
      NEW.queue := 'heavy';
    END IF;
  END IF;

  -- Heavy-queue jobs sort below every standard job (free baseline = 0).
  NEW.priority := _base - (CASE WHEN NEW.queue = 'heavy' THEN 20 ELSE 0 END);
  RETURN NEW;
END;
$$;
