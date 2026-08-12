-- Task #279 — Daily 4 Aura grant for ALL users (free and pro)
--
-- Mirrors the monthly free-grant pattern (20260701000002 / rebase version in
-- 20260719120000): deterministic per-day ref uuid + partial unique index makes
-- the grant idempotent, so the cron can fire any number of times per day and
-- each user is credited exactly once per calendar day (UTC, DB clock).

-- ── 1. Unique partial index: one daily_grant ledger row per ref ──────────────
-- Same shape as credit_ledger_monthly_aura_ref_idx. Must exist before the
-- function below ever runs — ON CONFLICT DO NOTHING relies on it.
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_daily_grant_ref_idx
  ON public.credit_ledger (ref_id)
  WHERE reason = 'daily_grant';

-- ── 2. Bulk daily grant: +4 Aura to EVERY profile, all plans ─────────────────
-- Set-based (single statement) rather than the monthly function's per-user
-- loop: this runs 30× more often, and one INSERT..ON CONFLICT + UPDATE pair
-- keeps ledger row and balance bump atomic per run.
-- Ref uuid = md5('daily:<user_id>:<YYYY-MM-DD>')::uuid  (the task's
-- idempotency key; equivalent bytes to the hyphenated md5 form used by the
-- monthly grant — Postgres casts bare 32-hex md5 text directly to uuid).
CREATE OR REPLACE FUNCTION public.grant_free_daily_aura_all(
  -- Explicit UTC: to_char(now(),...) alone would follow the SESSION TimeZone,
  -- and a session west of UTC could mint a previous-day ref → double grant.
  _day text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD')  -- e.g. '2026-08-12'
)
RETURNS integer  -- number of users credited this run
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _amount   integer := 4;  -- daily Aura top-up, identical for every plan
  _credited integer;
BEGIN
  WITH ins AS (
    -- Every profile row = every non-deleted user (account deletion removes
    -- the profiles row; there is no soft-delete flag on profiles).
    INSERT INTO public.credit_ledger (user_id, delta, reason, ref_id)
    SELECT
      p.user_id,
      _amount,
      'daily_grant',
      md5('daily:' || p.user_id::text || ':' || _day)::uuid
    FROM public.profiles p
    ON CONFLICT DO NOTHING
    RETURNING user_id
  )
  UPDATE public.profiles pr
     SET credits = pr.credits + _amount
    FROM ins
   WHERE pr.user_id = ins.user_id;

  GET DIAGNOSTICS _credited = ROW_COUNT;
  RETURN _credited;
END;
$$;

-- Cron-only surface: the endpoint calls this via the service-role client.
-- Without the revoke, Supabase default privileges would expose it to anon
-- PostgREST rpc.
REVOKE ALL ON FUNCTION public.grant_free_daily_aura_all(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_free_daily_aura_all(text) TO service_role;
