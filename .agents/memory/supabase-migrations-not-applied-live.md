---
name: Local migrations are not proof the live DB has them
description: supabase/migrations is a wish list, not a record of the live schema — and every new public table needs RLS explicitly.
---

## The repo's migration folder can be far ahead of the live database

A file in `supabase/migrations/` says only that someone wrote it. Nothing in this
project applies migrations automatically. Symptom the user sees: an admin screen
erroring with `Could not find the table 'public.<x>' in the schema cache` (PostgREST
code `PGRST205`) while the rest of the app looks fine.

**How to apply:** before debugging table-missing errors as code bugs, diff intent
against reality:
```sql
select to_regclass('public.<table>');
select version, name from supabase_migrations.schema_migrations where name ilike '%<topic>%';
```
Apply the missing files in timestamp order, then insert the matching
`schema_migrations` rows so a future `db push` doesn't replay them.

## Every new public table starts world-writable

Supabase grants `anon` and `authenticated` full `SELECT/INSERT/UPDATE/DELETE/TRUNCATE`
on new tables in `public` by default. A migration that creates a table and stops
there ships a table anyone holding the publishable key can rewrite — RLS defaults to
DISABLED, so there is nothing standing in the way.

**Why:** applying a long-dormant migration in this project produced exactly that —
a landing-image override table that any visitor could have overwritten.

**How to apply:** when a table is only ever touched through the service-role client
(server fns, API route handlers), the correct posture is deny-by-default —
`enable row level security` with ZERO policies, plus `revoke all ... from anon` and
`from authenticated`. Service role bypasses RLS, so the app keeps working. Verify by
hitting `/rest/v1/<table>` with the publishable key and expecting `401 / 42501`.
