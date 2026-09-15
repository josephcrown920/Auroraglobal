-- Harden SECURITY DEFINER trigger functions.
-- These functions are invoked by PostgreSQL triggers, not by client RPC calls.
-- Keep EXECUTE available to trusted roles only and pin search_path so object
-- resolution cannot be influenced by caller-controlled schemas.

REVOKE EXECUTE ON FUNCTION public.agent_chat_messages_broadcast_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.video_agent_messages_broadcast_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guided_workflows_set_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_generation_watermark_from_plan() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_job_priority_from_plan() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_admin_for_owner_emails() FROM anon, authenticated;

ALTER FUNCTION public.agent_chat_messages_broadcast_trigger()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.video_agent_messages_broadcast_trigger()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.guided_workflows_set_updated_at()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.set_generation_watermark_from_plan()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.set_job_priority_from_plan()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.grant_admin_for_owner_emails()
  SET search_path = public, pg_temp;
