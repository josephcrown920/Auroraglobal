---
name: Lovable overlapping snapshot migrations
description: Why `supabase db push` fails on Lovable-exported migration sets and how to apply them to a fresh DB.
---

# Lovable exports contain overlapping full-schema "snapshot" migrations

Lovable's `supabase/migrations/` export often interleaves **multiple full-schema rebuild
snapshots** (plain `create table public.X (...)` with NO `if not exists`) with ordinary
incremental migrations. Two+ snapshots each recreate the same tables, so a linear
`supabase db push` aborts with `relation "X" already exists` the moment replay reaches the
second snapshot.

**Why:** Lovable periodically "consolidates" the schema into a new snapshot migration but
leaves the older incrementals (and older snapshots) in the folder. Their own environment
doesn't replay linearly from zero, so the conflict never surfaces for them — it only bites
when you push the whole set to a brand-new database.

**How to apply to a FRESH / zero-data project (deterministic):**
1. Identify the **last** full-rebuild snapshot (the highest-timestamp migration whose
   `create table` list covers ~all app tables). Everything after it should only add NEW
   tables / alters.
2. Clean slate: `drop schema public cascade; create schema public;` re-grant usage/create +
   default privileges to `anon, authenticated, service_role, postgres`. Drop all
   `storage.objects` policies (snapshots recreate them without `if not exists`, so leftovers
   collide).
3. Baseline: `delete from supabase_migrations.schema_migrations;` then insert one row
   `(version, name)` for **every migration BEFORE the last snapshot** (mark them applied
   without running). `statements` column is nullable — version is all `db push` checks.
4. `echo y | supabase db push --db-url <session-pooler-url>` → applies only the last snapshot
   + the deltas after it. This replicates a fresh deploy order.

**What you lose by skipping pre-snapshot migrations:** only standalone DATA seeds (the last
snapshot is schema-only-equivalent and supersedes all earlier DDL). In Aurora those were 2
hardcoded admin `user_roles` rows pointing to OLD-project auth user IDs — useless on a fresh
backend. Verify nothing else seeds real data: `grep -ri "insert into" migrations | grep -v storage.buckets`
and confirm matches are inside function bodies, not top-level seeds.

**Validation that proves correctness:** if push applies the snapshot + ALL deltas with zero
errors, no delta depended on a skipped incremental. Then confirm: table count, storage
buckets/policies, `schema_migrations` row count == file count, key functions/triggers, and an
end-to-end signup (admin API create user → `handle_new_user` trigger makes profile + credit_ledger).

**Storage caveat:** you cannot `delete from storage.objects` / `storage.buckets` via SQL
(Supabase `protect_delete` trigger blocks it). Remove unwanted buckets via the Storage API
with the service-role key: `DELETE {SUPABASE_URL}/storage/v1/bucket/{id}`.
