-- Time-bounded Pro entitlement policy.
--
-- One-time crypto and Pro gift-card access is valid only through
-- profiles.subscription_expires_at. Recurring Paystack users remain entitled
-- through the provider's future next_payment_date, including a
-- cancellation_pending period that has already been paid for.

CREATE OR REPLACE FUNCTION public.has_active_pro_access(_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = _user
      AND p.plan = 'pro'
      AND (
        p.subscription_expires_at > now()
        OR EXISTS (
          SELECT 1
          FROM public.subscriptions s
          WHERE s.user_id = p.user_id
            AND s.status IN ('active', 'cancellation_pending')
            AND s.next_payment_date > now()
        )
      )
  );
$$;

-- Idempotently downgrade only lapsed access. A currently paid recurring
-- subscription is never downgraded, even if a stale profile expiry has not
-- yet been refreshed by its webhook.
CREATE OR REPLACE FUNCTION public.reconcile_expired_pro_access()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed integer;
BEGIN
  UPDATE public.profiles p
  SET plan = 'free',
      subscription_expires_at = NULL,
      paystack_subscription_code = NULL
  WHERE p.plan = 'pro'
    AND NOT public.has_active_pro_access(p.user_id);

  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;

-- Jobs and watermarks use the same policy as API gates. Admins stay exempt.
CREATE OR REPLACE FUNCTION public.set_job_priority_from_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _base int;
BEGIN
  _base := CASE
    WHEN public.has_active_pro_access(NEW.user_id) THEN 10
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = NEW.user_id AND ur.role = 'admin'
    ) THEN 10
    ELSE 0
  END;

  IF NEW.queue = 'standard' THEN
    IF NEW.kind IN ('lipsync', 'reshoot', 'multi_angle')
       OR (NEW.payload IS NOT NULL AND NEW.payload->>'kind' IN ('lipsync', 'reshoot', 'multi_angle'))
       OR (NEW.payload IS NOT NULL AND NEW.payload->>'resolution' IN ('1080p', '4K', '2160p'))
    THEN
      NEW.queue := 'heavy';
    END IF;
  END IF;

  NEW.priority := _base - (CASE WHEN NEW.queue = 'heavy' THEN 20 ELSE 0 END);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_generation_watermark_from_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.user_id AND role = 'admin'
  ) INTO _is_admin;
  NEW.is_watermarked := NOT (public.has_active_pro_access(NEW.user_id) OR _is_admin);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.has_active_pro_access(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_expired_pro_access() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_pro_access(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_expired_pro_access() TO service_role;