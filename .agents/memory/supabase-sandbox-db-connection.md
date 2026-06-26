---
name: Supabase live DB access from the Replit sandbox
description: How to reach the live Supabase Postgres from this repo's sandbox (use the pooler, not the direct host)
---

Live Supabase project ref for this repo is `tpzmvbczwahxajujvnrq` (matches `SUPABASE_URL`). `supabase/config.toml` may show a STALE ref — trust `SUPABASE_URL`.

**Connecting via psql from the sandbox:**
- The direct DB host is IPv6-only and the sandbox has NO IPv6 egress → direct connection hangs/fails.
- The `SUPABASE_DB_URL` secret is NOT a usable connection string (only a ~20-char project ref).
- Use the SESSION POOLER instead, passing the whole conninfo as ONE quoted arg:
  ```bash
  export PGPASSWORD="$SUPABASE_DB_PASSWORD"
  psql "host=aws-0-eu-west-1.pooler.supabase.com port=5432 user=postgres.tpzmvbczwahxajujvnrq dbname=postgres sslmode=require" -tAc "select 1"
  ```

**Recording a manually-applied migration:** insert into `supabase_migrations.schema_migrations`; columns are `version` (NOT NULL), `name` (nullable), `statements` (nullable).

**Why:** avoids repeated dead-ends against the direct host / the garbage `SUPABASE_DB_URL` secret.
**How to apply:** any time you run SQL or apply migrations against the LIVE DB from this sandbox.
