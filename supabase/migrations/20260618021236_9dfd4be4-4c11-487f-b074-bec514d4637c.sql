
REVOKE EXECUTE ON FUNCTION public.reserve_credits(uuid, integer, text, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.commit_reservation(uuid, integer, text, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.release_reservation(uuid, integer, text, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.create_generation_and_reserve(uuid, text, text, int, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.claim_next_job(text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.reserve_credits(uuid, integer, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.commit_reservation(uuid, integer, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_reservation(uuid, integer, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_generation_and_reserve(uuid, text, text, int, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_next_job(text) TO service_role;
