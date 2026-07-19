-- ×10 Aura rebase (2026-07-19) — CapCut-style credit scale.
-- USD prices are UNCHANGED. Every Aura amount in code was multiplied by 10
-- (1 new Aura = 1/10 old Aura), so every stored Aura balance/price/delta must
-- be multiplied by 10 in the same deploy window.
--
-- Idempotency: the whole rebase is guarded by a one-row event key so this
-- migration can never double-multiply balances if it is re-applied (shared
-- dev/prod DB; migrations here are sometimes applied manually via psql).

CREATE TABLE IF NOT EXISTS public.rebase_events (
  key        text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rebase_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rebase_events FROM PUBLIC, anon, authenticated;

-- One account holds ~1e9 Aura (admin balance); ×10 overflows int4, so widen
-- the wallet column to bigint first. Idempotent (re-run is a no-op rewrite).
-- The "profile self update" policy references `credits`, which blocks the
-- ALTER TYPE — drop it and recreate it verbatim afterwards.
DROP POLICY IF EXISTS "profile self update" ON public.profiles;

ALTER TABLE public.profiles ALTER COLUMN credits TYPE bigint;

CREATE POLICY "profile self update" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  (auth.uid() = user_id)
  AND (NOT (credits IS DISTINCT FROM (
    SELECT p.credits FROM public.profiles p WHERE p.user_id = auth.uid()
  )))
  AND (NOT (plan IS DISTINCT FROM (
    SELECT p.plan FROM public.profiles p WHERE p.user_id = auth.uid()
  )))
  AND (NOT (lifetime_credits_purchased IS DISTINCT FROM (
    SELECT p.lifetime_credits_purchased FROM public.profiles p WHERE p.user_id = auth.uid()
  )))
);

-- These two functions read the post-update `credits` value into an `int`
-- local, which would now throw 'integer out of range' for the 1e10 admin
-- wallet on every spend. Widen the locals to bigint; bodies otherwise
-- byte-identical to the live definitions.
CREATE OR REPLACE FUNCTION public.deduct_credits(_user uuid, _amount integer, _reason text, _ref uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare _new bigint;
begin
  update public.profiles set credits = credits - _amount
    where user_id = _user and credits >= _amount
    returning credits into _new;
  if _new is null then return false; end if;
  insert into public.credit_ledger (user_id, delta, reason, ref_id) values (_user, -_amount, _reason, _ref);
  return true;
end;
$$;

CREATE OR REPLACE FUNCTION public.reserve_credits(_user uuid, _amount integer, _reason text, _ref uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok bigint;
  _limit bigint;
  _spent numeric;
BEGIN
  -- Lock the profile row first so concurrent reservations for this user are
  -- serialized — required for the daily-cap check below to be race-free.
  SELECT daily_spend_limit INTO _limit FROM public.profiles WHERE user_id = _user FOR UPDATE;

  IF _limit IS NOT NULL THEN
    -- Sum today's (UTC) net spend from reserve/release ledger rows only —
    -- commits are zero-delta bookkeeping and top-ups/promo grants are a
    -- different reason prefix, so neither pollutes this sum.
    SELECT COALESCE(-SUM(delta), 0) INTO _spent
      FROM public.credit_ledger
     WHERE user_id = _user
       AND (reason LIKE 'reserve:%' OR reason LIKE 'release:%')
       AND created_at >= date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc';

    IF _spent + _amount > _limit THEN
      RAISE EXCEPTION 'daily_limit_reached';
    END IF;
  END IF;

  UPDATE public.profiles
     SET credits = credits - _amount,
         credits_reserved = credits_reserved + _amount
   WHERE user_id = _user
     AND credits >= _amount
  RETURNING credits INTO _ok;
  IF _ok IS NULL THEN RETURN false; END IF;
  INSERT INTO public.credit_ledger (user_id, delta, reason, ref_id)
    VALUES (_user, -_amount, 'reserve:' || _reason, _ref);
  RETURN true;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.rebase_events WHERE key = 'aura_rebase_x10') THEN
    RAISE NOTICE 'aura_rebase_x10 already applied — skipping balance multiplication';
    RETURN;
  END IF;

  -- Wallets and reservations
  UPDATE public.profiles
  SET credits                    = credits * 10,
      credits_reserved           = credits_reserved * 10,
      daily_spend_limit          = daily_spend_limit * 10,          -- NULL stays NULL
      lifetime_credits_purchased = lifetime_credits_purchased * 10;

  -- Full ledger history (daily-cap SUM() reads this — must stay consistent
  -- with the multiplied daily_spend_limit).
  UPDATE public.credit_ledger SET delta = delta * 10;

  -- In-flight reservations and historical charge records
  UPDATE public.jobs        SET credits_reserved = credits_reserved * 10;
  UPDATE public.generations SET credits_cost     = credits_cost * 10;

  -- Redeemables
  UPDATE public.gift_cards  SET credits       = credits * 10;
  UPDATE public.promo_codes SET bonus_credits = bonus_credits * 10; -- NULL stays NULL

  -- Marketplace pricing + revenue splits (denominated in Aura)
  UPDATE public.marketplace_templates    SET run_cost_aura = run_cost_aura * 10;
  UPDATE public.marketplace_template_runs
  SET aura_charged      = aura_charged * 10,
      creator_cut_aura  = creator_cut_aura * 10,
      platform_cut_aura = platform_cut_aura * 10;

  -- Purchase history (Aura granted per payment; money columns untouched)
  UPDATE public.payments SET credits_granted = credits_granted * 10;

  INSERT INTO public.rebase_events (key) VALUES ('aura_rebase_x10');
END;
$$;

-- ── Server-side grant amounts (hardcoded in SQL functions) ───────────────────

-- Signup bonus: 5 → 50 Aura. Body otherwise identical to 20260529012020.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (user_id, email, credits)
  values (new.id, new.email, 50)
  on conflict (user_id) do nothing;

  insert into public.credit_ledger (user_id, delta, reason)
  values (new.id, 50, 'signup_bonus');
  return new;
end;
$function$;

-- Free-tier monthly grant: 20 → 200 Aura (SUBSCRIPTION_TIERS.free.monthly_aura).
-- Body otherwise identical to 20260701000002.
CREATE OR REPLACE FUNCTION public.grant_free_monthly_aura_all(
  _month text DEFAULT to_char(now(), 'YYYY-MM')  -- e.g. '2026-07'
)
RETURNS integer  -- number of users credited this run
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _amount  integer := 200;  -- SUBSCRIPTION_TIERS.free.monthly_aura
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
