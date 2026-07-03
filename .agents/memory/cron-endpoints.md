---
name: Cron/scheduled endpoints + which DB this app really uses
description: How recurring work is scheduled here, the auth secret to use, and the wrong-database trap
---

# Cron / scheduled endpoints

Recurring work is exposed as a protected route under `src/routes/api/public/*`
(`jobs/tick.ts`, `workers/health.ts`) and triggered by an **external** Supabase
**pg_cron** job configured in the Supabase dashboard. The schedule is NOT in the
repo: `scripts/post-merge.sh` only runs `bun install`, and `supabase/migrations`
are applied by Lovable's pipeline (and `supabase/config.toml`'s `project_id`
doesn't even match the runtime DB), so do NOT add a pg_cron migration expecting
it to wire scheduling — document the dashboard SQL instead.

**Auth: use a server-only `CRON_SECRET`, NOT the Supabase anon key.**
`.replit` `userenv.shared` sets `SUPABASE_ANON_KEY == SUPABASE_PUBLISHABLE_KEY`
(a public client key). `tick.ts` historically gates on that anon key, but a code
review rejected reusing it for a privileged endpoint precisely because it's
public. `docs/ENV.md`/`ARCHITECTURE.md` already intend `CRON_SECRET` for cron
endpoints. Gate new cron endpoints on `process.env.CRON_SECRET` (fail closed),
return `5xx` on internal failure so a broken run is visible to the scheduler.

**Deployment target is Replit autoscale** (`.replit` `deploymentTarget =
"autoscale"`), request-driven, no native repo cron. The Cloudflare bits
(`wrangler.jsonc`, `@cloudflare/vite-plugin`) are build-only here, so a
Cloudflare `scheduled()` handler would NOT fire — don't rely on it.

## Trap: this app's DB is Supabase, not Replit Postgres
The `executeSql` tool / `replit_database` target hits Replit's managed
Postgres (Neon), which this app does NOT use. The app talks to **Supabase**
(`SUPABASE_URL` → ref `tpzmvbczwahxajujvnrq`) via the service-role key. So
`executeSql` showing "no pg_cron / no tables" is the wrong DB, not the truth.
To inspect the real DB use the Supabase session pooler (see
`supabase-sandbox-db-connection.md`), and note `executeSql environment:
"production"` errors with "no production Neon database" because there isn't one.

## Dev-server testing trap
End-to-end `curl` against `vite dev` is flaky: the sandbox harness SIGTERMs the
long-running dev process group and eats stdout. Prefer verifying route
registration in the regenerated `src/routeTree.gen.ts` (auto-generated on
`vite dev`/`build`) + lint over fighting the dev server.
