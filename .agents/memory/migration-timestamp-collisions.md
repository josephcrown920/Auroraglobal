---
name: Migration timestamp collisions across parallel task agents
description: Why a locally-authored migration filename can already exist (under a different name) in supabase_migrations.schema_migrations on the live DB
---

Isolated task agents apply migrations directly to the shared live Supabase DB as part of their own work, before their branch merges back into main. Because migration filenames are timestamp-prefixed (`YYYYMMDDHHMMSS_name.sql`) and multiple agents can pick a timestamp around "now" independently, a locally-authored migration file can collide with a *different* migration already recorded in `supabase_migrations.schema_migrations` under the same version — even though that other migration's `.sql` file doesn't exist yet in your local `supabase/migrations/` (it hasn't merged in).

**Why:** `schema_migrations.version` is the primary key; two different migrations can't share a version. If you apply/record yours under the colliding version, either the insert fails or (worse) you silently shadow/confuse the other agent's already-applied migration when branches merge.

**How to apply:** before applying any hand-authored migration to the live DB (via the session-pooler `psql` pattern), first query `select version, name from supabase_migrations.schema_migrations order by version desc limit 5` and diff against your local `supabase/migrations/` directory listing. If the live DB has a version your local filesystem doesn't recognize, that's another agent's in-flight work — rename your migration to a fresh, later timestamp before applying/recording it, so both migrations survive the eventual merge.
