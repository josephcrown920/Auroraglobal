# Backup & disaster recovery

This is the runbook for recovering Aurora's database and understanding what
is (and isn't) currently backed up. It complements `docs/DB_MIGRATIONS.md`
(schema change process) and `docs/DATABASE.md` (connection/access details).

## Build & source protection layers ("onion")

Every production build is wrapped in concentric protection layers so a broken
build can never take the site down permanently and a good state is always
restorable.

1. **Build snapshots** — `node scripts/build.js` (the deployer's cached build
   command; `artifacts/web`'s `production.build` delegates to it too, as does
   the `prod-build` workflow) snapshots `.output` after every successful
   `vite build` into `.build-snapshots/snapshots/<yyyymmdd-hhmmssz>-<sha>/`
   (hardlink farm via `cp -al`, so retained snapshots cost almost no extra
   disk) and moves the `current` candidate pointer. The newest 3 snapshots
   are kept (`AURORA_SNAPSHOT_RETAIN`); rotation never deletes the snapshot
   that `last-known-good` points at. Symlink targets are relative so the
   whole tree is relocatable (deploy containers, drill scratch copies).
2. **Post-build health gate** — after snapshotting, `scripts/health-gate.mjs`
   boots the fresh snapshot on a freshly allocated scratch port (an explicit
   port override exists only for the drill) and probes `/api/health`
   (dependency-free, unauthenticated, `no-store`), verifying both the
   `{ok:true}` health body and — via /proc listener-socket ownership — that
   the answering socket belongs to the candidate's own process group. An
   unrelated local listener (e.g. one that won the release-to-spawn race
   while the candidate stayed alive but never bound) can never be mistaken
   for the candidate. Only a healthy build moves the `last-known-good` pointer, and a
   build that compiles but won't boot FAILS the build (`node
   scripts/build.js` exits non-zero) so it is never deployed — the previously
   deployed instance keeps serving. The gate needs the SUPABASE_* runtime
   values to boot the server (the server hard-refuses without them); a build
   environment that cannot show them to the gate fails the build too —
   fail-closed, never silently trusting an unprobed candidate. Emergency
   escape hatch: `AURORA_BUILD_SKIP_HEALTH_GATE=1`.
3. **Start-time auto-restore** — the production run command
   (`scripts/start-prod.sh`, wired as `artifacts/web`
   `[services.production].run`) sanity-checks and boot-probes the current
   build before serving it. If the current build is missing, won't boot, or
   doesn't answer healthy, it LOUDLY falls back to the `last-known-good`
   snapshot and serves that instead, exiting non-zero only when neither can
   serve. Escape hatch: `AURORA_START_SKIP_PROBE=1`.
4. **Source backup refs** — `scripts/git-backup-refs.sh` maintains rotating
   local git refs on the main workspace only: `backup/YYYY-MM-DD` (14 kept)
   and `backup/monthly/YYYY-MM` (12 kept), created once per UTC day by the
   GitHub sync daemon (which rides inside the cron workflow). These protect
   recent source states against a bad rebase/force-push/reset inside the
   workspace; the GitHub mirror (Auroraglobal) protects against losing the
   workspace itself. The refs stay local on purpose: the published GitHub
   lineage has >=100MB blobs stripped (`scripts/github-autopush.sh`), so
   pushing raw workspace refs would be rejected.
5. **Recovery drill** — `scripts/dr-recovery-drill.sh` proves the restore
   path works: in a sandboxed scratch copy it breaks the current build, runs
   the REAL start guard, and asserts the app serves from the
   last-known-good snapshot (plus the healthy-build — exercised through the
   dynamically allocated probe-port path — and both-broken cases). It runs in
   CI as part of `bun test src/` (`src/lib/recovery/dr-layers.test.ts`) and
   on demand: `bash scripts/dr-recovery-drill.sh`. The suite additionally
   proves a TERM-resistant server is SIGKILLed without leaking a listener,
   and that the gate allocates a fresh probe port when the legacy default
   port is squatted by an unrelated server.

**Heap-cap interplay:** the build heap cap appears in three places that must
be raised together as the app grows: `scripts/build.js` (default 3072 MB,
used by the 4 GB deploy builder), the `prod-build` workflow command (4608 MB,
larger dev container), and `artifacts/web/.replit-artifact/artifact.toml`
`production.build`. `scripts/start-prod.sh` carries the matching runtime cap.

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

| Layer | RPO | RTO |
| --- | --- | --- |
| Broken/bad production **build** | No loss: every successful build is snapshotted (last 3 retained), and the restore target (`last-known-good`) is at most one deploy behind and always health-proven. | One process restart: the start guard detects the broken build and serves the last-known-good snapshot on the next boot (probe + boot ≈ 1–2 minutes). |
| Bad **source** state on Main (rebase/force-push/reset) | ≤ 24 h via daily `backup/<date>` refs (14 daily + 12 monthly); tighter via the GitHub mirror, which syncs within ~1 minute of each commit when healthy. | Minutes: `git checkout backup/<date>` (or reset Main to it) and redeploy. |
| **Workspace loss** | Whatever the GitHub mirror last synced (≤ ~1 min behind Main when the sync daemon is healthy — check `.local/.github-sync-status.json`). | Recreate from the mirror: new workspace from the repo, restore secrets manually (they are not escrowed — see below), redeploy. Unmeasured; estimate < 1 h. |
| **Database** | Plan-dependent — see "What backs up the database today" above (action item: confirm tier). Unchanged by the build/source layers. | Never drilled end-to-end; schedule a restore drill against a disposable Supabase project once the tier is confirmed. |

These are targets, now defined, for the build/source layers; the product
owner should still confirm the database tier row and set a stricter database
RPO if the business needs it.

**Restore drill status:** PERFORMED 2026-09-05 —
`scripts/dr-recovery-drill.sh` passes all six checks (broken-build
auto-restore to last-known-good, loud fallback logging, healthy-build direct
serve, no spurious fallback, both-broken loud non-zero exit without hanging).
It runs continuously as part of `bun test src/`, so a regression in the
restore path fails the test suite. Re-run on demand after touching
`scripts/build.js`, `scripts/start-prod.sh`, `scripts/health-gate.mjs`, or
`scripts/build-snapshot.mjs`.

## Status

**Build/source layers: live and drilled.** Snapshots, the health gate, the
start-time auto-restore, rotating backup refs, and the recovery drill are all
in place and covered by `bun test src/`. Still unverified: the Supabase
backup tier/retention (dashboard access required), a database restore drill,
and storage-bucket backup.
