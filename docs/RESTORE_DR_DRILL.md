# Aurora Restore / DR Drill

## Purpose

Prove that Aurora can be recovered from backup without modifying production and without relying on undocumented manual steps.

## Safety rules

1. Never perform the drill against the production database.
2. Use a disposable Supabase project/database and isolated storage target.
3. Never commit production secrets, tokens, database URLs, or service-role keys.
4. Keep the production release commit unchanged during the drill.

## Inputs to record

- Release commit SHA:
- Supabase backup tier:
- Backup timestamp:
- Database size:
- Storage object count/size sampled:
- Target project:
- Drill start (UTC):
- Drill end (UTC):

## Procedure

1. Select a known-good production backup according to the configured retention policy.
2. Create an isolated restore target.
3. Restore the database.
4. Verify schema version and reconcile migrations using `docs/DB_MIGRATIONS.md`.
5. Regenerate/verify application database types if schema changed.
6. Restore representative Storage objects using the documented storage backup method.
7. Point an isolated application instance at the restored target only.
8. Run health/readiness checks.
9. Run `scripts/verify-no-double-refund.sql`.
10. Run `scripts/verify-idempotency-concurrent-claim.sql`.
11. Run `scripts/verify-concurrent-credit-reservation.sql`.
12. Exercise representative authentication, project read/write, generation submission, job finalization, and asset retrieval flows with test accounts only.
13. Verify that restored records reference available assets and that no production destination is contacted by test jobs.
14. Measure restore time and record any manual remediation.
15. Destroy the disposable target after evidence is captured.

## Pass criteria

- Database restore completes without data-integrity errors.
- Migration state is reconciled with no collisions.
- Critical concurrency/idempotency proofs pass.
- Readiness endpoint reports healthy dependencies.
- Representative application flows work against the restored target.
- Representative stored assets are recoverable.
- RTO target is met.
- Estimated data loss is within the RPO target.
- No production secrets are exposed in drill artifacts.

## Evidence

Attach or link the non-secret evidence here:

- Restore logs:
- Migration verification:
- SQL proof results:
- Application smoke-test results:
- Storage recovery evidence:
- Restore duration:
- Observed data-loss window:
- Issues/remediation:

## Failure handling

If any critical pass criterion fails, do not declare 100/100. Create a remediation issue, preserve the evidence, and repeat the drill after the fix.
