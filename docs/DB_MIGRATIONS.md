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