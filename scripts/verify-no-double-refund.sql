-- Live-DB proof that finalize_job()'s lock-ownership fence prevents
-- double-commit and double-refund of credits.
--
-- Two race scenarios that a buggy worker/sweeper interaction could otherwise
-- cause:
--   A) The SAME worker calls finalize_job twice for one job (e.g. a
--      duplicated network retry) — must only ever commit/release ONCE.
--   B) The stale-processing sweeper reassigns a job to a NEW worker while
--      the OLD worker is still mid-flight. The old worker's late finalize
--      call must be fenced (return 'stale') and must NOT double-refund
--      credits that the new worker is legitimately handling.
--
-- Safety: this entire script runs inside BEGIN/ROLLBACK, so it makes zero
-- permanent changes — safe to re-run anytime against the live database as a
-- regression check after touching jobs.server.ts, finalize_job, or the
-- stale-sweep logic.
--
-- Usage:
--   PGPASSWORD=$SUPABASE_DB_PASSWORD psql "<connection string>" \
--     -f scripts/verify-no-double-refund.sql
--
-- Expected output (see the labelled \echo lines):
--   A1 -> finalized, A2 -> stale, ledger for job A has exactly ONE commit row
--   B1 -> stale (no refund), B2 -> finalized, ledger for job B has exactly
--   ONE commit row (never a release row from the fenced-out old worker)

BEGIN;

\set qa_user '''4dcc6eed-8b04-4195-a2ad-78f455b6a5d5'''

\echo '--- BEFORE (qa-test user profile) ---'
SELECT credits, credits_reserved FROM public.profiles WHERE user_id = :qa_user;

UPDATE public.profiles SET credits = 100, credits_reserved = 0
  WHERE user_id = :qa_user;

-- ============================================================
-- Scenario A: same worker calls finalize_job twice for one job
-- ============================================================
UPDATE public.profiles SET credits_reserved = 10 WHERE user_id = :qa_user;

INSERT INTO public.jobs (id, user_id, kind, status, credits_reserved, locked_by, locked_at)
VALUES ('00000000-0000-0000-0000-0000000000a1', :qa_user, 'image', 'processing', 10, 'worker-A', now());

\echo '--- A1: first finalize (worker-A, succeeded) -> expect finalized ---'
SELECT public.finalize_job('00000000-0000-0000-0000-0000000000a1', 'worker-A', 'succeeded', '{}'::jsonb, NULL, NULL, NULL, NULL);

\echo '--- A2: SECOND finalize, same job + same worker -> expect stale (no double-commit) ---'
SELECT public.finalize_job('00000000-0000-0000-0000-0000000000a1', 'worker-A', 'succeeded', '{}'::jsonb, NULL, NULL, NULL, NULL);

\echo '--- A: profile after both calls (credits_reserved must be 0, not negative) ---'
SELECT credits, credits_reserved FROM public.profiles WHERE user_id = :qa_user;

\echo '--- A: ledger rows for this job (must be exactly ONE commit row) ---'
SELECT delta, reason FROM public.credit_ledger WHERE ref_id = '00000000-0000-0000-0000-0000000000a1' ORDER BY created_at;

-- ============================================================
-- Scenario B: stale-sweep reclaim race — old worker (A) tries to
-- fail/release a job that a new worker (B) already re-claimed.
-- ============================================================
UPDATE public.profiles SET credits_reserved = 10 WHERE user_id = :qa_user;

INSERT INTO public.jobs (id, user_id, kind, status, credits_reserved, locked_by, locked_at)
VALUES ('00000000-0000-0000-0000-0000000000b1', :qa_user, 'image', 'processing', 10, 'worker-A', now());

-- Simulate the stale-processing sweeper reassigning the lock to worker-B
UPDATE public.jobs SET locked_by = 'worker-B', locked_at = now()
  WHERE id = '00000000-0000-0000-0000-0000000000b1';

\echo '--- B1: OLD worker-A tries to fail/release AFTER losing the lock -> expect stale (no refund) ---'
SELECT public.finalize_job('00000000-0000-0000-0000-0000000000b1', 'worker-A', 'failed', '{}'::jsonb, 'boom', NULL, NULL, NULL);

\echo '--- B: profile after the stale release attempt (credits must still be 100, reserved still 10) ---'
SELECT credits, credits_reserved FROM public.profiles WHERE user_id = :qa_user;

\echo '--- B2: NEW worker-B (legitimate current owner) finalizes as succeeded -> expect finalized ---'
SELECT public.finalize_job('00000000-0000-0000-0000-0000000000b1', 'worker-B', 'succeeded', '{}'::jsonb, NULL, NULL, NULL, NULL);

\echo '--- B: profile after legitimate finalize (credits_reserved must be 0) ---'
SELECT credits, credits_reserved FROM public.profiles WHERE user_id = :qa_user;

\echo '--- B: ledger rows for this job (must be exactly ONE commit row, never a release from worker-A) ---'
SELECT delta, reason FROM public.credit_ledger WHERE ref_id = '00000000-0000-0000-0000-0000000000b1' ORDER BY created_at;

ROLLBACK;
\echo '--- transaction rolled back, no permanent changes made ---'
