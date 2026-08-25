-- Recurring Paystack renewals must never shorten a separately purchased or
-- gifted Pro term. Preserve the later existing expiry when recording the
-- provider's current paid-through date.

CREATE OR REPLACE FUNCTION public.activate_pro_subscription(
  _user uuid,
  _sub_code text,
  _expires_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET plan = 'pro',
      subscription_expires_at = GREATEST(
        COALESCE(subscription_expires_at, _expires_at),
        _expires_at
      ),
      paystack_subscription_code = _sub_code
  WHERE user_id = _user;
END;
$$;