-- A Paystack disable event stops renewal, not the already-paid subscription
-- period. Keep the row cancellation_pending until its provider paid-through
-- date passes, then finalize it during the same protected reconciliation that
-- removes any genuinely lapsed Pro profile.

CREATE OR REPLACE FUNCTION public.reconcile_expired_pro_access()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed integer;
BEGIN
  UPDATE public.subscriptions
  SET status = 'cancelled',
      updated_at = now()
  WHERE status = 'cancellation_pending'
    AND (next_payment_date IS NULL OR next_payment_date <= now());

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