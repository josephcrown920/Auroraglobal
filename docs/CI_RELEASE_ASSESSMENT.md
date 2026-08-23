# Aurora CI and release assessment

## Scope and current conclusion

This assessment separates Aurora source-code evidence from third-party
infrastructure blockers. The current conclusion is **not production-ready**:
the repaired local quality gate can be reproduced, but GitHub Actions cannot
yet run because the account is billing-locked, and normal LFS retrieval is
budget-blocked.

## Actions-history findings

The available GitHub Actions history contains 827 runs:

| Outcome | Runs |
| --- | ---: |
| Success | 91 |
| Failure after starting | 130 |
| Startup failure | 586 |
| Cancelled | 20 |

- Earliest recorded run: Dynamic Dependabot Graph Update, run 1, June 30,
  2026 — startup failure.
- Earliest successful run: run 2, July 2, 2026.
- Earliest ordinary failure: Dynamic Dependabot npm/yarn update, run 9,
  July 21, 2026.
- Last success before the current quality-gate failure period: Dynamic
  Dependabot npm/yarn update, August 20, 2026.
- First subsequent quality-gate failure: Aurora quality gate run 4,
  August 20, 2026.
- Latest quality-gate failure reviewed: run 39, August 23, 2026, paired with
  `Push on Main` run 71.

Both current quality jobs (`Lint, types, tests, build` and
`Playwright end-to-end`) stop in roughly three seconds without executing a
step. GitHub reports: **“The job was not started because your account is
locked due to a billing issue.”**

This is an external runner refusal, not a test, build, or Copilot-timing
failure. The available history does not establish a causal relationship
between Copilot subscription timing and the failure period.

## External storage blocker

An authenticated normal checkout also encountered Git LFS budget exhaustion.
The local audit used an LFS-safe sparse checkout and fetched only the media
files explicitly imported by source for build validation. This keeps the
storage limit distinct from application correctness; it does not resolve the
LFS budget for ordinary development or deployment.

## Quality-gate review

The `Aurora quality gate` workflow runs on pull requests, pushes to `main` and
`Main`, and manual dispatch. It uses Ubuntu, Node 22, Bun 1.3.6, `npm ci`,
lint, typecheck, Bun unit tests, migration and worker-boundary audits, and the
canonical production build. Its E2E job is skipped for fork pull requests so
staging secrets are not exposed.

The E2E environment now supplies:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Playwright now launches Vite through the Node executable that launched
Playwright, rather than a Replit-only shell helper. The suite includes a
landing-page smoke test and therefore cannot silently pass with no discovered
tests.

## Confirmed repairs

1. **Deterministic unit tests.** Router telemetry no longer caches an unusable
   lazy Supabase proxy; AI-module, provider-key, fetch, and worker-health
   tests no longer leak shared global state into sibling suites. Tests inject
   harmless values and fakes where their production code exposes a dependency
   seam; production secret validation remains fail-fast.
2. **Meaningful production gate.** `npm run production:gate` runs the same
   Node/Vite release build documented for Replit, and the CI workflow invokes
   it.
3. **Portable E2E execution.** The browser job no longer depends on
   `available-pid2-node-paths`, which is unavailable on generic GitHub-hosted
   runners.

No test, security check, or production gate was removed.

## Independent validation record

| Check | Result | Notes |
| --- | --- | --- |
| `npm ci` with npm 10.9.2 | PASS | Node 22-compatible resolver; original lockfile is unchanged. |
| `npm run lint` | PASS | Existing warnings remain non-fatal. |
| `npm run typecheck` | PASS | No TypeScript errors. |
| `npm test` / `bun test src/` | PASS | 1178 passed, 1 skipped, 0 failed. |
| Migration filename/collision audit | PASS | `bash scripts/check-migrations.sh`. |
| Worker-boundary audit | PASS | `node scripts/ci/audit-worker-entry.mjs`. |
| `npm run production:gate` | PASS | Canonical Replit release build passed after the CI repair. |
| Playwright test discovery | PASS | One landing-page smoke test is discovered. |
| Full local Playwright browser run | BLOCKED LOCALLY | The portable Vite web server starts and Chromium downloads, but this Replit container cannot load Chromium's remaining `libgbm.so.1` dependency. GitHub's E2E job is configured to install Chromium with Ubuntu dependencies once billing is restored. |
| Hosted GitHub quality/E2E jobs | BLOCKED EXTERNALLY | Billing lock prevents job startup. |

## Production finish line

The outstanding release work is tracked in the root `ROADMAP.md`. Do not
declare production readiness until the external blockers are cleared and every
listed production gate has direct, current evidence.