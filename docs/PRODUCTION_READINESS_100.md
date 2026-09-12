# Aurora Production Readiness — 100/100 Gate

This document is the execution checklist for closing the remaining production-readiness gaps without making unsafe changes to `Main`.

## Current rule

Do not merge unrelated branches or PR #84 while this gate is being completed.

## Gate A — Backup & Disaster Recovery

- [ ] Confirm the live Supabase backup tier and retention in the dashboard.
- [ ] Record the selected backup/retention policy in `docs/BACKUP_AND_DR.md`.
- [ ] Define business-approved RPO (maximum acceptable data loss).
- [ ] Define business-approved RTO (maximum acceptable recovery time).
- [ ] Establish a backup strategy for Supabase Storage objects in addition to database backups.
- [ ] Create a disposable restore target/project.
- [ ] Restore the database/schema into the disposable target.
- [ ] Reconcile migrations using the existing migration runbook.
- [ ] Restore representative storage objects and verify references.
- [ ] Run the existing `verify-*.sql` concurrency/idempotency proofs against the restored database.
- [ ] Record restore duration, failures, remediation, and evidence.
- [ ] Repeat the drill after material infrastructure changes.

## Gate B — Security

- [ ] Rotate every credential identified as exposed in repository history, including the VolcEngine credential called out by the roadmap.
- [ ] Confirm production secrets are supplied only through the deployment/provider secret store.
- [ ] Re-run RLS/grant audit after any schema change.
- [ ] Confirm every new table has a migration, correctly scoped RLS, and minimal grants.
- [ ] Review client-visible error paths for provider/database secret leakage.

## Gate C — Reliability & Observability

- [ ] Wire `/api/ready` into an external uptime/health monitor.
- [ ] Alert on readiness failures and sustained provider/worker failures.
- [ ] Confirm generation queue/recovery sweeps have actionable monitoring.
- [ ] Document incident response and rollback procedure.
- [ ] Confirm deployment rollback can be performed without rewriting Git history.

## Gate D — Performance / Financial Correctness

- [ ] Add dedicated tests proving any incremental daily-spend calculation cannot undercount.
- [ ] Only then optimize `credit_ledger` daily-spend aggregation.
- [ ] Design and test streaming uploads before replacing the current buffered 200MB audio path.
- [ ] Load-test critical generation routes after performance changes.

## Gate E — Release Validation

Run against the exact release candidate commit:

- `tsc --noEmit`
- `eslint .`
- `bun test src/`
- MCP tests
- `scripts/check-migrations.sh`
- `scripts/ci/audit-worker-entry.mjs`
- full Playwright suite
- live readiness check
- provider smoke tests for every enabled production provider
- credit reservation / refund / idempotency proofs

Record the exact commit SHA and evidence before declaring release-ready.

## 100/100 definition

Aurora is 100/100 only when all required gates above are evidenced, not merely implemented in source code. Dashboard-only items, restore drills, secret rotation, and provider smoke tests require real production evidence.
