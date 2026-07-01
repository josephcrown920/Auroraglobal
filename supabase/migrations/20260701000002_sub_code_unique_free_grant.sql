-- Task #152 — (a) Unique constraint on paystack_subscription_code
--             (b) Bulk free-tier monthly Aura grant RPC

-- ── 1. Unique constraint on subscriptions.paystack_subscription_code ─────────
-- The webhook upsert uses onConflict:"paystack_subscription_code" which requires
-- a unique constraint, not just an index.  Drop the non-unique index and replace.
DROP INDEX IF EXISTS public.subscriptions_code_idx;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_paystack_subscription_code_key
  UNIQUE (paystack_subscription_code);

-- ── 2. Bulk free-tier monthly Aura grant ─────────────────────────────────────
-- Called by the /api/public/free-monthly-grant cron endpoint.
-- The ref UUID is deterministic: md5('free:<user_id>:<YYYY-MM>')::uuid
-- This matches the ref used by the TypeScript onboarding flow in billing.functions.ts,
-- so a user who signed up mid-month and received their initial Aura will NOT be
-- double-credited when the cron runs.
CREATE OR REPLACE FUNCTION public.grant_free_monthly_aura_all(
  _month text DEFAULT to_char(now(), 'YYYY-MM')  -- e.g. '2026-07'
)
RETURNS integer  -- number of users credited this run
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _amount  integer := 20;  -- SUBSCRIPTION_TIERS.free.monthly_aura
  _credited integer := 0;
  _rows    integer;
  _user_id uuid;
  _hash    text;
  _ref     uuid;
BEGIN
  FOR _user_id IN
    -- All non-Pro profiles; new profiles (plan IS NULL) are also Free.
    SELECT user_id FROM public.profiles
    WHERE (plan IS NULL OR plan <> 'pro')
  LOOP
    -- Deterministic UUID matching the TypeScript deterministicUuid('free:<uid>:<month>')
    _hash := md5('free:' || _user_id::text || ':' || _month);
    _ref  := (
      substring(_hash, 1, 8)  || '-' ||
      substring(_hash, 9, 4)  || '-' ||
      substring(_hash, 13, 4) || '-' ||
      substring(_hash, 17, 4) || '-' ||
      substring(_hash, 21, 12)
    )::uuid;

    -- Idempotent insert; conflict on unique partial index (reason='monthly_aura').
    INSERT INTO public.credit_ledger (user_id, delta, reason, ref_id)
    VALUES (_user_id, _amount, 'monthly_aura', _ref)
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS _rows = ROW_COUNT;
    IF _rows > 0 THEN
      UPDATE public.profiles
      SET credits = credits + _amount
      WHERE user_id = _user_id;
      _credited := _credited + 1;
    END IF;
  END LOOP;

  RETURN _credited;
END;
$$;
