-- Enable Aurora's bounded motion autoscaler by default.
-- The controller remains fail-closed: it only provisions when there is active
-- motion backlog, prefers a configured RunPod Serverless endpoint, and falls
-- back to one managed Vast worker under the existing $0.35/hr + one-hour cap.
alter table public.motion_autoscale_state
  alter column enabled set default true;

update public.motion_autoscale_state
set enabled = true,
    updated_at = now()
where singleton = true
  and enabled = false;