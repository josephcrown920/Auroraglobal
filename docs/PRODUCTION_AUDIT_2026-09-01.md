# Aurora Global — Production Audit — 2026-09-01

This audit is evidence-based against the `Main` branch. It deliberately separates repository/code evidence from external runtime configuration. A checkbox is not marked complete merely because documentation says it should be.

## Executive result

**Codebase:** materially hardened and has a deterministic production gate.

**Production release:** not yet provable as fully live from repository access alone.

### Remaining external release gates

1. **Soul video provider credentials:** `SEEDANCE_API_URL` and `SEEDANCE_API_KEY` are documented but the roadmap explicitly records them as unset. Soul video therefore cannot be claimed production-live until the runtime secret store contains valid credentials and the provider contract is verified.
2. **Supabase backup/DR:** backup tier/retention and a real restore drill require Supabase dashboard/project access and a disposable restore target. The repository contains the runbook but not proof of a completed restore.
3. **Production deployment:** the repository cannot by itself prove that the latest `Main` commit is the version serving the public deployment. Deployment verification must be performed against the live deployment.
4. **Authenticated staging E2E:** the full signed-in Playwright pass requires Supabase E2E secrets. The test harness can skip cleanly without them, but that is not equivalent to a successful authenticated staging run.

## Verified complete from repository evidence

- RLS/authorization hardening is recorded in `ROADMAP.md` as verified, including the lockdown migration and corrected ownership policies.
- Expensive generation routes have explicit per-user rate limits.
- Storage access uses scoped object policies and signed URLs where private assets require them.
- User-facing error paths have server-side redaction via `safeErrorMessage`.
- `/api/ready` performs a real Supabase readiness check and returns 503 when the dependency check fails.
- Concurrency/idempotency proof scripts exist for generation claiming and credit reservation.
- The repository production gate includes lint, typecheck, unit tests, migration checks, worker-boundary audit, and production build.
- The Soul training flow atomically claims a Soul before reserving credits/provider work and reconciles failed reservations.
- Soul image generation is routed through the existing orchestrator with the pinned Soul image model.
- Soul video generation is wired to the pinned `seedance-soul` model and sends signed reference images through the existing orchestration path. The missing piece is runtime provider configuration, not a speculative new adapter.

## Fixed in this audit

### Daily spend guardrail

The previous implementation read every matching `credit_ledger` row for the current day into Node and summed it in JavaScript. That is both a scalability problem and a dangerous place to apply a naive row limit because truncation could undercount spend.

This audit added:

- `supabase/migrations/20260901010000_daily_spend_rpc.sql`
  - PostgreSQL-side `get_daily_spend(user, day_start)` aggregation.
  - Restricted function execution to `service_role`.
  - Supporting `(user_id, created_at)` index.
- `src/lib/cost-guardrails.server.ts`
  - Production daily-budget reads now call the database aggregation RPC instead of fetching an unbounded ledger result set.
  - Existing injectable test seam remains intact.

**Important:** the migration is committed to GitHub. It is not evidence that the migration has already been applied to the production Supabase project. That requires the Supabase migration/deployment pipeline to run it.

## Not patched because the repository cannot safely prove the external dependency

### Seedance

Do not fabricate an endpoint, authentication scheme, or model contract. The repo already identifies `seedance-soul` as the Soul video model and documents the required runtime variables. The correct remaining action is to supply and validate real provider credentials/configuration.

### Backups / disaster recovery

Do not mark DR complete because a markdown runbook exists. The actual Supabase backup tier, retention window, object-storage backup strategy, and disposable-project restore drill remain external verification tasks.

### Large audio uploads

The existing architecture can buffer uploads up to the documented limit. Replacing it with streaming/direct-to-storage requires an architectural change and should not be disguised as a small production fix.

### Wan/GFPGAN Soul pipeline

No verified provider contract was found in the repository. It remains deferred rather than enabled against invented APIs.

## Acceptance gate

Aurora should be called **Production Complete** only when all of the following are demonstrated:

- [x] Repository production gate exists.
- [x] Core authorization/rate-limit/error/concurrency hardening is represented in the repo.
- [x] Daily spend aggregation has a database-side implementation committed.
- [ ] Daily-spend migration is confirmed applied to production Supabase.
- [ ] Seedance runtime credentials/configuration are present and a real Soul video generation succeeds.
- [ ] Supabase backup tier/retention is confirmed.
- [ ] Object-storage backup/replication is confirmed.
- [ ] Disposable-project restore drill succeeds and is documented.
- [ ] Authenticated staging E2E suite passes with real E2E secrets.
- [ ] Latest `Main` commit is confirmed serving in production.
- [ ] Critical production routes are verified live with HTTP 200 and no global error boundary.

## Source-of-truth notes

`ROADMAP.md` remains the historical production-readiness roadmap. This file is the dated audit snapshot so future audits can distinguish what was already claimed in the roadmap from what was actually rechecked on 2026-09-01.
