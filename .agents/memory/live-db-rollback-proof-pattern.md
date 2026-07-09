---
name: Rolled-back live-DB transaction as a safe correctness proof
description: How to prove a financial/concurrency RPC behaves correctly against the real production database without polluting data or needing mocks.
---

To prove something like a credit RPC or lock-fencing CAS actually behaves
correctly on the real Supabase database (not just in mocked unit tests),
write a single `psql` script that does `BEGIN;` ... asserts via `\echo` +
`SELECT` after each step ... `ROLLBACK;`. Everything inside — inserts,
updates, RPC calls including `SECURITY DEFINER` ones — executes for real
against production data and rolls back atomically at the end, so it is safe
to re-run anytime with zero permanent side effects.

**Why:** mocked unit tests can drift from what the real RPC actually does
(e.g. a migration changes the function body but the mock doesn't). A
rolled-back live transaction is a genuine proof, not a simulation, while
still being non-destructive — the two properties that matter most for
finance-adjacent verification (spend limits, credit reservation, job
finalization fences).

**How to apply:** use literal fixture UUIDs for throwaway rows (e.g. a job
id like `00000000-...-a1`), and construct the exact race you're worried
about *inside the transaction* (e.g. simulate a stale-sweep reclaim by
`UPDATE`-ing `locked_by` between two `finalize_job` calls). Assert on the
final ledger/table state before rolling back. Save the script under
`scripts/verify-*.sql` with a header explaining what it proves so it can be
re-run as a regression check after touching the same RPC. Used for the
`reserve_credits` daily-spend-limit check and the `finalize_job` double-
refund fence.
