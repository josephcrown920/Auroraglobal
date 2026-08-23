-- Live-DB proof that generation_idempotency_keys' primary key on
-- (user_id, idempotency_key) fences a real concurrent double-click / network
-- retry so it can win credits/generation exactly once, matching the claim
-- logic in src/lib/generate-core.server.ts (buildDefaultIdempotencyDeps.claim).
--
-- Because Postgres enforces a PRIMARY KEY constraint atomically against any
-- number of truly concurrent transactions (the second concurrent INSERT
-- always blocks-then-fails with 23505, never silently succeeds twice), a
-- single-session script that exercises both branches of that race —
-- "I win the insert" vs "I lose the insert and must read the winner's row" —
-- is a valid proof of the same guarantee that would hold under real
-- concurrency. This mirrors the pattern already used by
-- scripts/verify-no-double-refund.sql for the jobs.finalize_job race.
--
-- Safety: this entire script runs inside BEGIN/ROLLBACK, so it makes zero
-- permanent changes — safe to re-run anytime against the live database as a
-- regression check after touching generate-core.server.ts or the
-- generation_idempotency_keys table/policies.
--
-- Usage:
--   PGPASSWORD=$SUPABASE_DB_PASSWORD psql "<connection string>" \
--     -f scripts/verify-idempotency-concurrent-claim.sql
--
-- Expected output (see the labelled \echo lines):
--   1) Request A's INSERT succeeds (wins the race, claimed=pending).
--   2) Request B's INSERT for the SAME key fails with 23505 (loses the race)
--      — proving only one concurrent request can ever hold "pending".
--   3) After A finishes successfully, a THIRD late arrival with the same key
--      sees status='succeeded' and would replay A's cached response instead
--      of charging or rendering again.
--   4) A DIFFERENT key for the same user is unaffected (claims independently).

BEGIN;

\set qa_user '''4dcc6eed-8b04-4195-a2ad-78f455b6a5d5'''
\set race_key '''concurrency-proof-key-1'''
\set other_key '''concurrency-proof-key-2'''

\echo '--- 1) Request A: first INSERT for the key -> expect SUCCESS (wins the race) ---'
INSERT INTO public.generation_idempotency_keys (user_id, idempotency_key, status)
VALUES (:qa_user, :race_key, 'pending');

\echo '--- 2) Request B: SECOND INSERT for the SAME key -> expect unique_violation (23505), i.e. it loses the race ---'
DO $$
BEGIN
  INSERT INTO public.generation_idempotency_keys (user_id, idempotency_key, status)
  VALUES ('4dcc6eed-8b04-4195-a2ad-78f455b6a5d5', 'concurrency-proof-key-1', 'pending');
  RAISE EXCEPTION 'BUG: second concurrent claim was NOT fenced — this must never happen';
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'OK: second claim correctly rejected with unique_violation (23505)';
END;
$$;

\echo '--- 2b) Request B reads the row it lost to (as the real claim() code does after a 23505) -> must see the pending row from A ---'
SELECT status, generation_id, response FROM public.generation_idempotency_keys
  WHERE user_id = :qa_user AND idempotency_key = :race_key;

\echo '--- 3) Request A finishes successfully; a LATE THIRD arrival with the same key must replay, never re-charge ---'
UPDATE public.generation_idempotency_keys
   SET status = 'succeeded',
       response = '{"generationId":"00000000-0000-0000-0000-0000000000c1"}'::jsonb,
       updated_at = now()
 WHERE user_id = :qa_user AND idempotency_key = :race_key;

SELECT status, response FROM public.generation_idempotency_keys
  WHERE user_id = :qa_user AND idempotency_key = :race_key;

\echo '--- 4) A DIFFERENT key for the same user claims independently (no cross-key interference) ---'
INSERT INTO public.generation_idempotency_keys (user_id, idempotency_key, status)
VALUES (:qa_user, :other_key, 'pending');

SELECT idempotency_key, status FROM public.generation_idempotency_keys
  WHERE user_id = :qa_user AND idempotency_key IN (:race_key, :other_key)
  ORDER BY idempotency_key;

ROLLBACK;
\echo '--- transaction rolled back, no permanent changes made ---'
