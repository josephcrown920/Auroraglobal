-- Subscription activation and deactivation are webhook-only privileged actions.
-- SECURITY DEFINER without explicit ACLs is publicly executable in Postgres,
-- which would let a caller assign arbitrary users arbitrary Pro expiries.

REVOKE ALL ON FUNCTION public.activate_pro_subscription(uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_pro_subscription(uuid, text, timestamptz)
  TO service_role;

REVOKE ALL ON FUNCTION public.deactivate_pro_subscription(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_pro_subscription(uuid)
  TO service_role;