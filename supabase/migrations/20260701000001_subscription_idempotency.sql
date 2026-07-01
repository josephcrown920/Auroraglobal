-- Task #152 — Make grant_monthly_aura idempotent
-- Webhook retries / Paystack duplicate events must never double-credit Aura.

-- ── 1. Unique index on credit_ledger for monthly_aura grants ─────────────────
-- Only monthly_aura entries carry a ref_id that doubles as a dedup key.
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_monthly_aura_ref_idx
  ON public.credit_ledger (ref_id)
  WHERE reason = 'monthly_aura';

-- ── 2. Rewrite grant_monthly_aura to be fully idempotent ─────────────────────
-- Inserts a ledger row with the event ref_id; ON CONFLICT skips the credit.
-- Returns TRUE if Aura was granted, FALSE if already processed.
-- Must DROP first because we're changing the return type void → boolean.
DROP FUNCTION IF EXISTS public.grant_monthly_aura(uuid, integer, uuid);
CREATE OR REPLACE FUNCTION public.grant_monthly_aura(
  _user   uuid,
  _amount integer,
  _ref    uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Try inserting the ledger entry.  If the ref already exists → skip.
  INSERT INTO public.credit_ledger (user_id, delta, reason, ref_id)
  VALUES (_user, _amount, 'monthly_aura', _ref)
  ON CONFLICT DO NOTHING;

  IF NOT FOUND THEN
    -- Already processed — do nothing.
    RETURN false;
  END IF;

  -- Credit only landed once: update the profile balance.
  INSERT INTO public.profiles (user_id, credits)
  VALUES (_user, _amount)
  ON CONFLICT (user_id)
  DO UPDATE SET credits = public.profiles.credits + _amount;

  RETURN true;
END;
$$;

-- ── 3. Add cancellation_pending status support on subscriptions ───────────────
-- No schema change needed — status is a free-text column.
-- Documenting the accepted values here for reference:
--   active              — subscription is active and will renew
--   cancellation_pending — user cancelled; Pro access continues until period end
--   cancelled           — Paystack confirmed the subscription is disabled
COMMENT ON COLUMN public.subscriptions.status IS
  'active | cancellation_pending | cancelled';
