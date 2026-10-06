---
name: Atomic rate controls in code review
description: Server-side cooldowns/caps/throttles must be atomic (conditional UPDATE reservation or RPC) — read-then-act checks get rejected in architect review
---

# Atomic rate controls in code review

Any server-side rate control added to this repo — cooldowns, attempt caps, per-resource API-call throttles — must be **atomic**, not read-then-act. The architect review rejects `SELECT → check → act` patterns because concurrent/direct server-function calls bypass them.

**Why:** During the TikTok post-history work, three rounds of review rejected successively: an unbounded retry, then a read-then-act cooldown+count cap, then a soft timestamp throttle. Only fully atomic versions passed.

**How to apply:**
- Cooldowns/caps that mutate state: single conditional `UPDATE ... WHERE <guard conditions> RETURNING ...` (Postgres holds the row lock while evaluating, so losers see 0 rows). Need an in-statement counter increment (`retry_count = retry_count + 1`)? PostgREST can't express it — write a `security definer` SQL RPC, REVOKE from public/anon/authenticated, GRANT to service_role, and apply the migration to the live DB + record it in `supabase_migrations.schema_migrations` + regen types (`scripts/check-supabase-types.sh --write`) in the same change.
- External-API call throttles: claim first with the same conditional-UPDATE trick (e.g. stamp `updated_at` where `updated_at < now() - interval`), then call the external API only if the claim matched a row.
- After claiming a row, put every subsequent failure-capable step (token refresh included) inside the failure handler so the row can't strand in a claimed/processing state.
- React Query keys holding user data must be partitioned by `user.id` — a global key leaks the previous account's cached data across in-browser account switches.
