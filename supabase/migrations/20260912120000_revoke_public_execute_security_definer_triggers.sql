-- Remove the default PUBLIC EXECUTE grant from SECURITY DEFINER trigger functions.
-- Revoking only from anon/authenticated is insufficient because those roles inherit
-- PUBLIC privileges. These functions are invoked by PostgreSQL triggers, not RPC.

REVOKE EXECUTE ON FUNCTION public.agent_chat_messages_broadcast_trigger() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.video_agent_messages_broadcast_trigger() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guided_workflows_set_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_generation_watermark_from_plan() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_job_priority_from_plan() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_admin_for_owner_emails() FROM PUBLIC;

ALTER FUNCTION public.agent_chat_messages_broadcast_trigger() SET search_path = public, pg_temp;
ALTER FUNCTION public.video_agent_messages_broadcast_trigger() SET search_path = public, pg_temp;
ALTER FUNCTION public.guided_workflows_set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_generation_watermark_from_plan() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_job_priority_from_plan() SET search_path = public, pg_temp;
ALTER FUNCTION public.grant_admin_for_owner_emails() SET search_path = public, pg_temp;
