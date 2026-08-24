---
name: Cron/scheduled endpoints + which DB this app really uses
description: How recurring work is scheduled here, the auth secret to use, and the wrong-database trap
---

# Cron / scheduled endpoints

Recurring work is exposed as protected routes under `src/routes/api/public/*`
and triggered by the long-lived Replit `cron` workflow, which runs
`scripts/aurora-cron-daemon.sh` against the app on localhost. It is not a
Supabase `pg_cron` schedule; do not add a database migration expecting one to
wire recurring work.

**Auth: the scheduler sends server-only `CRON_SECRET` via the `apikey` header.**
All scheduled side-effect routes use `authorizeCronStrict`, which accepts ONLY
`CRON_SECRET` and fails closed when the secret is unset — the Supabase
anon/publishable key is in every browser bundle and must never authorize cron
work (legacy compatibility was removed 2026-08-24). The deletion sweep is the
exception: it authenticates with `INTER_APP_API_KEY` instead. A missing helper
call can make the daemon continuously return curl `22` (HTTP 401) even though
the secret exists.

**Deployment target is Replit autoscale** (`.replit` `deploymentTarget =
"autoscale"`), request-driven, so keep the scheduler as a managed workflow.
The Cloudflare bits (`wrangler.jsonc`, `@cloudflare/vite-plugin`) are build-only
here, so a Cloudflare `scheduled()` handler would not fire.

## Trap: this app's DB is Supabase, not Replit Postgres
The `executeSql` tool / `replit_database` target hits Replit's managed
Postgres (Neon), which this app does NOT use. The app talks to **Supabase**
(`SUPABASE_URL` → ref `tpzmvbczwahxajujvnrq`) via the service-role key. So
`executeSql` showing "no pg_cron / no tables" is the wrong DB, not the truth.
To inspect the real DB use the Supabase session pooler (see
`supabase-sandbox-db-connection.md`), and note `executeSql environment:
"production"` errors with "no production Neon database" because there isn't one.

## Dev-server testing
After changing scheduler auth, restart the application and cron workflows, then
call a representative route with `CRON_SECRET` in the `apikey` header and check
for HTTP 200. Do not print the secret while diagnosing mismatches; compare
one-way fingerprints only.
