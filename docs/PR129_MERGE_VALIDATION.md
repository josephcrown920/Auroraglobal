# PR #129 merge resolution

Merged `Main` at `2745054e90462e5cd698963f51d0e1baccdb76a0` into
`codex/crm-ci-final` at `97931e6ba98fda57949459d94922e680e42ad400`.
The merge retains both histories and resolves all 14 conflicted paths.

## Resolution decisions

- Keep Main's current AI adapters, proxy support, structured-output fixes, and
  ModelArk/free agent-brain routing. Do not restore retired provider slugs.
- Keep Main's mobile Babel compatibility pin and mobile CI typecheck.
- Keep Main's account-scoped video editor queries and per-tab E2E lifecycle;
  retain the PR's explicit missing-backend-secrets skip.
- Retain the PR's CRM handlers, telemetry, Baby Agent, Video Agent studio and
  streaming, GPU observability/readiness, and daily-spend aggregate RPC.
- Regenerate the route tree with both branches' routes.
- Keep Main's deletion of the obsolete root lockfile and scaffold backup.
- Preserve the previously existing CRM migration. Apply the PR's worker-status
  correction in a new migration rather than rewriting applied SQL history.
- Add CRM input validators and synchronize table/event types with its migration.
- Use one production-gate script in local development and CI, including the
  PR's isolated Bun test runner.
- Correct the two Main MCP syntax errors and small lint blockers discovered
  while validating this integration.

## Validation and existing blockers

The initial resolution passed lint (warnings remain), mobile TypeScript,
migration filename/collision checks, the worker-boundary audit, and focused
tests for Baby Agent planning, observability statistics, provider registration,
cost guardrails, and authentication return paths.

The repository-wide gate is **not green**. Main already contains missing agent
and orchestration contracts. In particular, `agent.functions.ts` lacks
`chatWithAuroraAgent` and related exports still imported by the UI, and lacks
`renderAgentShotCore` imported by the integration test. These files are unchanged
from Main by the resolution. The production build and full test suite stop on
those missing exports. A comparison after correcting Main's parser errors also
found broad existing TypeScript failures; this merge does not certify deployment
readiness or suppress those checks.

Live authenticated E2E and database migration application were not performed.
The repository's Git LFS quota also prevented downloading large attachments.
