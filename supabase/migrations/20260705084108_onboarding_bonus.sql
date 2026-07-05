-- Onboarding completion bonus: a one-time credit reward for finishing the
-- vibe + selfie onboarding flow. Idempotent via a boolean flag flipped with
-- a compare-and-swap UPDATE (WHERE onboarding_bonus_granted = false), so a
-- retried/duplicate client call can never grant twice.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_bonus_granted boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.claim_onboarding_bonus(_user uuid, _amount integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _claimed boolean;
BEGIN
  UPDATE public.profiles
    SET onboarding_bonus_granted = true
    WHERE user_id = _user AND onboarding_bonus_granted = false
    RETURNING true INTO _claimed;
  IF _claimed IS NULL THEN
    RETURN false;
  END IF;
  PERFORM public.grant_credits(_user, _amount, 'onboarding_bonus', NULL);
  RETURN true;
END; $$;

REVOKE EXECUTE ON FUNCTION public.claim_onboarding_bonus(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_onboarding_bonus(uuid, integer) TO service_role;
