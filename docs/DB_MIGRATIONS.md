# Database migrations

Aurora's database schema is versioned in `supabase/migrations/`. The repository
currently contains the complete timestamped migration history; this is not a
greenfield schema and old migrations must not be replaced with a new
`001_create_*` baseline.

## Applying changes

1. Create a disposable or staging Supabase project first.
2. Confirm the target project and backup/restore point.
3. Run the repository's normal Supabase migration command:

   ```sh
   supabase db push
   ```

4. Regenerate and verify client types:

   ```sh
   bash scripts/check-supabase-types.sh
   ```

5. Run `npm run typecheck`, `bun test src/`, and the relevant E2E smoke tests.

The live schema migration ledger is the source of truth. Before applying a
migration, compare the local filename list with the target ledger so a
timestamp collision from another branch is renamed before it is pushed.

## Migration audit (CI-enforced)

`bash scripts/check-migrations.sh` (also run in CI on every push/PR) checks
the local `supabase/migrations/` tree for two structural problems that have
caused real incidents:

- **Timestamp collisions.** The ledger primary-keys on the leading
  `YYYYMMDDHHMMSS` timestamp. Two files sharing one timestamp mean only the
  first one applied gets recorded — the second can silently be skipped by a
  fresh `supabase db push` even though its table already exists live (it was
  applied once, out of band). `20260629020000_app_settings.sql` and the
  original `20260629020000_kids_stories.sql` collided this way; the latter
  was renamed to `20260629020001_kids_stories.sql` and the live ledger was
  backfilled with that version so future pushes see it as already applied
  instead of retrying it forever.
- **Filename format.** Every file must match `YYYYMMDDHHMMSS_slug.sql` or
  version parsing (by this script, and by the Supabase CLI) breaks.

Because every migration in this repo writes idempotent DDL (`create table if
not exists`, `drop policy if exists` + `create policy`, etc. — see existing
files for the pattern), a renamed-but-already-applied file safely re-running
once against the live DB is a no-op; keep new migrations idempotent for the
same reason.

## Rollback policy

Migrations are forward-only. We do not ship generic destructive “down” files:
many Aurora migrations add data, security grants, or account-retention rules
that cannot be safely reversed without product-specific decisions.

For a bad migration:

1. stop the deployment;
2. restore the staging database from its backup if data is affected;
3. write a compensating migration that preserves existing user data;
4. validate it against staging and the type generator;
5. apply it to production during the approved maintenance window.

Never run `DROP TABLE`, broad `DELETE`, or privilege changes directly against
production as an ad-hoc rollback.

## Scheduled jobs

Scheduled maintenance is currently driven by the Replit `cron` workflow. The
workflow calls the protected `/api/public/*` maintenance routes and records
success/failure in its logs. The account-deletion sweep uses the private
`INTER_APP_API_KEY`; it must not be changed back to the public Supabase key.