-- Task #180: per-user daily Aura spend cap.
--
-- Enforced at the DB level inside reserve_credits() so every spend path is
-- covered (reserveOrchestrateRecord AND the ~10 direct
-- create_generation_and_reserve callers), not just the two named app entry
-- points. A per-user row lock (FOR UPDATE on profiles) serializes concurrent
-- reservations for the same user, closing the race where two near-limit
-- requests could both pass a naive read-then-check.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_spend_limit integer
    CHECK (daily_spend_limit IS NULL OR daily_spend_limit > 0);

-- Speeds up the per-user, per-day ledger sum below (no index existed on
-- credit_ledger before this).
CREATE INDEX IF NOT EXISTS credit_ledger_user_created_idx
  ON public.credit_ledger (user_id, created_at);

CREATE OR REPLACE FUNCTION public.reserve_credits(_user uuid, _amount integer, _reason text, _ref uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok int;
  _limit int;
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
END; $$;
