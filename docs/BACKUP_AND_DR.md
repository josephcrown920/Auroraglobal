# Backup & disaster recovery

This is the runbook for recovering Aurora's database and understanding what
is (and isn't) currently backed up. It complements `docs/DB_MIGRATIONS.md`
(schema change process) and `docs/DATABASE.md` (connection/access details).

## What backs up the database today

Aurora's persistent state lives entirely in Supabase Postgres (project
`tpzmvbczwahxajujvnrq`, `eu-west-1`). Supabase provides automatic backups,
but the retention window and whether point-in-time recovery (PITR) is
available depend on the project's **billing plan tier** (Free plans get no
automatic backups at all; Pro+ gets daily backups; Team/Enterprise or the
PITR add-on gets continuous PITR). This tier has not been confirmed from
inside this workspace — an operator with dashboard access must verify it
under **Project Settings → Add-ons → Backups** and record the answer here.

**Action item (blocked on dashboard access):** confirm the current plan/backup
tier and retention window, then replace this paragraph with the concrete
answer (e.g. "Pro plan, daily backups, 7-day retention" or "PITR enabled,
2-minute granularity, 7-day window").

## What is NOT backed up by Supabase

- **Object storage** (`studio` bucket) — file bytes for generated
  images/videos/uploads. Supabase backups cover the Postgres database only,
  not Storage objects. There is currently no documented replication or backup
  process for the bucket's contents. Given results are provider-hosted URLs
  in many code paths (`docs/DATABASE.md` / memory: "Studio bucket result
  URLs" — runners return raw provider URLs rather than re-persisting), a
  chunk of "lost" storage objects would show as broken thumbnails rather than
  data loss of the generation record itself, but locally re-uploaded assets
  (avatars, reference photos, TikTok remix inputs) would be genuinely lost.
- **Secrets/environment variables** — managed via Replit Secrets, not part of
  any database backup. Losing the workspace loses these; there is no secret
  escrow beyond whatever the operator has stored outside Replit.

## Recovery runbook (schema + data)

1. **Identify the target restore point.** Supabase dashboard → Database →
   Backups (or PITR timeline if enabled). Choose the most recent point before
   the incident.
2. **Restore via the Supabase dashboard**, not by hand-replaying migrations —
   a dashboard restore recreates the actual data, not just the schema shape.
   Follow Supabase's own restore flow for the project's plan tier.
3. **Reconcile schema drift after restore.** The restored snapshot may predate
   migrations that were applied after it was taken. Compare
   `supabase_migrations.schema_migrations` on the restored database against
   the filenames in `supabase/migrations/`, then re-run `supabase db push`
   for any migration that is missing. This mirrors the collision-check
   process already documented in `docs/DB_MIGRATIONS.md`.
4. **Regenerate types and validate.**
   ```sh
   bash scripts/check-supabase-types.sh
   npm run typecheck && bun test src/
   ```
5. **Spot-check the concurrency/idempotency invariants still hold** by
   re-running the live-DB proof scripts in `BEGIN ... ROLLBACK` mode against
   the restored database (`scripts/verify-no-double-refund.sql`,
   `scripts/verify-idempotency-concurrent-claim.sql`,
   `scripts/verify-concurrent-credit-reservation.sql`) — these are read/no-op
   in aggregate (everything they touch is rolled back) but will fail loudly
   if a restore left constraints or RPCs in an unexpected state.
6. **Resume the cron daemon and workers.** `scripts/aurora-cron-daemon.sh`
   and self-hosted GPU workers reconnect on their own once the app and DB are
   reachable again — no special resume step, but confirm
   `/api/public/uptime-monitor` reports `ok:true` and `gpu_workers` rows have
   recent `last_heartbeat` values before declaring recovery complete.

## Recovery point / recovery time objectives

**Not yet formally defined.** RPO is bounded by whatever backup cadence the
confirmed plan tier provides (daily backup ⇒ up to 24h of data loss in the
worst case; PITR ⇒ minutes). RTO has never been drilled end-to-end. Both are
a business decision, not a technical one — recommend the product owner set
explicit RPO/RTO targets once the backup tier above is confirmed, and then
schedule an actual restore drill against a disposable Supabase project (per
`docs/DB_MIGRATIONS.md`'s "create a disposable or staging project first"
rule) to measure real RTO rather than estimate it.

## Status

**In progress.** This document establishes the runbook and calls out exactly
what remains unverified (backup tier/retention, RPO/RTO, storage-bucket
backup). It intentionally does not claim a restore drill has been performed —
none has, in this session or (per this doc's absence before now) any prior
one.
