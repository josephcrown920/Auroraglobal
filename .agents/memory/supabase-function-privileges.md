---
name: Supabase function privileges & date-keyed idempotency
description: Every new public function ships anon-EXECUTABLE by default; credit RPCs need same-migration REVOKE, and date-keyed dedup must pin UTC.
---

**Rule 1:** Every `CREATE FUNCTION` in `public` is executable by PUBLIC/anon/authenticated via PostgREST rpc by default (Supabase default privileges). Any SECURITY DEFINER function that grants credits, flips privileged flags, or takes caller-controlled amounts/refs MUST ship `REVOKE ALL ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role;` in the same migration.

**Why:** The monthly grant fns shipped without a revoke — `grant_monthly_aura(_user,_amount,_ref)` was anon-callable with caller-controlled amount (arbitrary credit minting to any account), and `grant_free_monthly_aura_all(_month)` minted fresh refs per arbitrary month string. Closed 2026-08-12 (hardening migration); all legit callers were service-role so the revoke was behavior-preserving.

**Rule 2:** Date-keyed idempotency (`to_char(now(), 'YYYY-MM-DD')` refs) must use `now() AT TIME ZONE 'utc'` — bare `to_char(now(),…)` follows the SESSION TimeZone, so a west-of-UTC session mints a previous-day key and double-grants. DB default is UTC but sessions can override; don't rely on it.

**How to apply:** Any migration adding/replacing a public function: append the revoke/grant pair. Any dedup key derived from the clock: pin the timezone explicitly, and prove idempotency with a `SET timezone='America/Los_Angeles'` re-call test.

**Verify a suspect fn:** `select grantee, privilege_type from information_schema.routine_privileges where routine_name='<fn>'`.
