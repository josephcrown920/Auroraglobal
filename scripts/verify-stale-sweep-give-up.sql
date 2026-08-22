-- Live-DB proof that the stale-sweep give-up path (task #345) releases a
-- crash-looping job's reservation EXACTLY ONCE and can never double-release
-- a job whose worker is still legitimately running.
--
-- Scenarios:
--   S1) Stale `processing` job at the persistent-retry attempt ceiling →
--       sweep terminally fails it, releases the reservation (exactly ONE
--       ledger release row), stamps credits_settled_at.
--   S2) The original (still-alive) worker finalizes AFTER the give-up →
--       finalize_job must return 'stale' and add NO second ledger row.
--   S3) Stale `processing` job UNDER the ceiling → re-queued as before, the
--       reservation stays held (no ledger row, credits_reserved intact).
--   S4) A still-heartbeating job at the ceiling (fresh locked_at) → sweep
--       must NOT touch it at all.
--   S5) Running the sweep a second time is a no-op for the given-up job
--       (returns 0, no extra ledger rows).
--
-- Safety: the whole script runs inside BEGIN/ROLLBACK — zero permanent
-- changes; safe to re-run anytime against the live database after touching
-- jobs.server.ts, finalize_job, or the stale-sweep RPCs.
--
-- Usage:
--   PGPASSWORD=$SUPABASE_DB_PASSWORD psql "<connection string>" \
--     -f scripts/verify-stale-sweep-give-up.sql

BEGIN;

\set qa_user '''4dcc6eed-8b04-4195-a2ad-78f455b6a5d5'''

\echo '--- BEFORE (qa-test user profile) ---'
SELECT credits, credits_reserved FROM public.profiles WHERE user_id = :qa_user;

UPDATE public.profiles SET credits = 100, credits_reserved = 30
  WHERE user_id = :qa_user;

-- S1: at ceiling (attempts 48), stale lock (locked_at 20m ago) → give up
INSERT INTO public.jobs (id, user_id, kind, status, credits_reserved, attempts, locked_by, locked_at)
VALUES ('00000000-0000-0000-0000-0000000000c1', :qa_user, 'image', 'processing', 10, 48, 'worker-dead', now() - interval '20 minutes');

-- S3: under ceiling (attempts 3), stale lock → plain re-queue
INSERT INTO public.jobs (id, user_id, kind, status, credits_reserved, attempts, locked_by, locked_at)
VALUES ('00000000-0000-0000-0000-0000000000c2', :qa_user, 'image', 'processing', 10, 3, 'worker-dead', now() - interval '20 minutes');

-- S4: at ceiling BUT heartbeat fresh (locked_at now) → must be untouched
INSERT INTO public.jobs (id, user_id, kind, status, credits_reserved, attempts, locked_by, locked_at)
VALUES ('00000000-0000-0000-0000-0000000000c3', :qa_user, 'image', 'processing', 10, 48, 'worker-alive', now());

\echo '--- SWEEP #1 (15m window, ceiling 48 / 48h) -> expect 2 (1 requeued + 1 gave up) ---'
SELECT public.reset_stale_processing_jobs(900, 15, 48, 172800);

\echo '--- S1: gave-up job -> expect failed / stale_worker_lock_gave_up / settled stamped ---'
SELECT status, error, locked_by, (credits_settled_at IS NOT NULL) AS settled
  FROM public.jobs WHERE id = '00000000-0000-0000-0000-0000000000c1';

\echo '--- S1: ledger for the gave-up job -> exactly ONE release row (+10) ---'
SELECT delta, reason FROM public.credit_ledger
 WHERE ref_id = '00000000-0000-0000-0000-0000000000c1' ORDER BY created_at;

\echo '--- S3: under-ceiling job -> expect queued / stale_worker_lock, NO ledger rows ---'
SELECT status, error FROM public.jobs WHERE id = '00000000-0000-0000-0000-0000000000c2';
SELECT count(*) AS s3_ledger_rows FROM public.credit_ledger
 WHERE ref_id = '00000000-0000-0000-0000-0000000000c2';

\echo '--- S4: fresh-heartbeat job at ceiling -> expect UNTOUCHED (processing, worker-alive) ---'
SELECT status, locked_by FROM public.jobs WHERE id = '00000000-0000-0000-0000-0000000000c3';

\echo '--- Profile: 30 reserved - 10 released -> expect credits 110, reserved 20 ---'
SELECT credits, credits_reserved FROM public.profiles WHERE user_id = :qa_user;

\echo '--- S2: late finalize by the ORIGINAL worker of the gave-up job -> expect stale ---'
SELECT public.finalize_job('00000000-0000-0000-0000-0000000000c1', 'worker-dead', 'succeeded', '{}'::jsonb, NULL, NULL, NULL, NULL);

\echo '--- S2: ledger unchanged (still exactly ONE row), profile unchanged ---'
SELECT delta, reason FROM public.credit_ledger
 WHERE ref_id = '00000000-0000-0000-0000-0000000000c1' ORDER BY created_at;
SELECT credits, credits_reserved FROM public.profiles WHERE user_id = :qa_user;

\echo '--- S5: SWEEP #2 -> expect 0 (give-up is not repeatable; requeued job is queued now) ---'
SELECT public.reset_stale_processing_jobs(900, 15, 48, 172800);
SELECT count(*) AS c1_ledger_rows FROM public.credit_ledger
 WHERE ref_id = '00000000-0000-0000-0000-0000000000c1';

ROLLBACK;

\echo '--- ROLLED BACK: no permanent changes were made ---'
