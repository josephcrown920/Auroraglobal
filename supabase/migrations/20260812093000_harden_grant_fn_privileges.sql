-- Task #279 (adjacent hardening) — credit-grant RPCs must not be publicly
-- executable. Supabase default privileges grant EXECUTE to PUBLIC / anon /
-- authenticated on new public functions, and both monthly grant functions
-- shipped without a revoke:
--   * grant_monthly_aura(_user, _amount, _ref) takes caller-controlled user,
--     AMOUNT and ref — anon-executable via PostgREST rpc, this allowed
--     arbitrary credit minting to any account by anyone with the public key.
--   * grant_free_monthly_aura_all(_month) mints fresh refs for ANY month
--     string, so repeated anon calls could credit all free users unboundedly.
-- Every legitimate caller uses the service-role client (paystack webhook,
-- billing onboarding, /api/public/free-monthly-grant), so revoking public
-- execution preserves behavior exactly. The functions themselves are
-- deliberately unchanged (out of scope for #279).
REVOKE ALL ON FUNCTION public.grant_monthly_aura(uuid, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_monthly_aura(uuid, integer, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.grant_free_monthly_aura_all(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_free_monthly_aura_all(text) TO service_role;
