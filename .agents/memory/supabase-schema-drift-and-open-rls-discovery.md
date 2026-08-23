---
name: Schema drift tables can hide wide-open RLS
description: A table can exist live with zero migration file backing it, and can carry fully permissive RLS despite having an ownership column — check both independently, not just "does a policy exist".
---

Found live: `boards`, `board_items`, `chat_threads` had NO corresponding `CREATE TABLE` in any migration file (grepping the migrations directory for the table name returned nothing) even though real server code (`account-purge.server.ts`) queries them and depends on them existing. A fresh DB built from migration history alone would silently be missing these tables.

Independently, all three tables — despite each having a `user_id` column — carried fully permissive RLS: `"Open access ..." USING (true) WITH CHECK (true)` plus separate open per-action policies, AND full grants (including `TRUNCATE`, which bypasses RLS entirely) to **both** `anon` and `authenticated`. Any caller holding just the public anon key could read/write/delete/truncate every user's rows, with no login required.

A sibling live table (`render_jobs`) had the same class of gap from a different angle: real, actively-used table (feeds a real UI panel), but no ownership column *at all*, so its `SELECT ... USING (true)` policy let any authenticated user list every other user's jobs.

**Why this matters:** "RLS is enabled" and "a `user_id` column exists" are not evidence a table is actually scoped — a policy can exist and still be `USING (true)`. Also, `\d public.<table>` in a live DB is not proof the table is tracked in version control; grep migrations by table name separately.

**How to apply:** when auditing Supabase security, for every table (a) confirm it actually has a migration file (fresh-DB-buildable), (b) print its live policies verbatim and check each one's `USING`/`WITH CHECK` expression actually references the ownership column (not `true`), and (c) check grants to `anon`/`authenticated` include only what's needed — `TRUNCATE`/`REFERENCES`/`TRIGGER` on end-user roles are almost never intentional. Fix by adding a documenting "schema backfill" migration (idempotent `CREATE TABLE IF NOT EXISTS`, matching the live shape exactly, no new constraints) *before* the RLS-lockdown migration, so history and live state agree.
