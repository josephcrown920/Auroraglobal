
REVOKE EXECUTE ON FUNCTION public.grant_credits(uuid, integer, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_credits(uuid, integer, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_credits(uuid, integer, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, integer, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
