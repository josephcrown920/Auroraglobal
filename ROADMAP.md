# Aurora Studio — Build Roadmap

Living product roadmap plus the authoritative production-readiness finish line. Do not create new hardening work once all final release gates pass.

Last updated: 2026-08-22

---

## 🏁 FINAL PRODUCTION FINISH LINE

Aurora is **Production Complete / Maintenance Mode** only when every release gate below is verified with repository evidence and passing validation. If an external credential/service/configuration prevents verification, mark the gate **BLOCKED** with the exact required action instead of claiming completion.

| # | Release gate | Current status | Verification requirement |
|---|---|---|---|
| 1 | Auth & account lifecycle | 🟡 VERIFY | Email/password, Apple Sign In, sessions, verification/reset, OAuth failures, protected routes |
| 2 | Critical Aurora workflows | 🟡 VERIFY | Image/video/lipsync/canvas/UGC/core workflows pass end-to-end |
| 3 | Credits & billing integrity | 🟡 VERIFY | Exactly-once charging/refunds, webhook idempotency, retry/concurrency safety |
| 4 | AI provider reliability | 🟡 VERIFY | Hard timeouts, transient-only retries, safe fallback, terminal failure state |
| 5 | Jobs & workers | 🟡 VERIFY | Lease/heartbeat, stale recovery, retry limits, duplicate protection, graceful shutdown |
| 6 | Security | 🟡 VERIFY | RLS/authorization, storage/signed URLs, admin boundaries, rate limits, secret/log redaction |
| 7 | CI quality gate | 🟢 IMPLEMENTED / VERIFY RUN | CI workflow exists for lint, typecheck, unit tests, worker audit, build and Playwright E2E |
| 8 | Database / migrations / recovery | 🟡 VERIFY | Deterministic migrations, environment validation, backup/recovery readiness |
| 9 | Observability / operations | 🟡 VERIFY | Health/readiness, structured failures, provider/job latency and error visibility |
| 10 | Production mobile / Expo path | 🟡 VERIFY | Auth, API, uploads, deep links, network handling, release configuration |

**Important:** repository inspection confirms the CI quality-gate workflow exists and the package scripts expose lint/typecheck/test/build/e2e commands. Runtime pass/fail for the full suite must still be verified by an actual CI or Replit run. fileciteturn15file0

### Stop rule

Once all 10 gates are PASS and the final validation suite is green:

- Mark this roadmap **PRODUCTION COMPLETE / MAINTENANCE MODE**.
- Stop generating additional hardening tasks.
- Only address concrete production bugs, security incidents, dependency/platform changes, or intentionally approved product features.

---

## 🧪 Feature test matrix

Goal: green every critical workflow before production. The original feature matrix remains useful as the functional smoke suite.

| # | Feature | Endpoint / fn | Auth | Status |
|---|---|---|---|---|
| 1 | Image generation | `generatePerformanceShot` | yes | 🟡 Runtime verification required |
| 2 | Video generation | `generateVideoFromImage` | yes | 🟡 Runtime verification required |
| 3 | Lip sync | `startLipsync` / `getLipsyncJob` | yes | 🟡 Runtime verification required |
| 4 | Canvas | split-reality + workflows | yes | 🟡 Runtime verification required |
| 5 | UGC factory | `generateUGCAd` | yes | 🟡 Runtime verification required |
| 6 | Colors studio | studio color preset | yes | 🟡 Runtime verification required |

Pass criteria:
- Server function succeeds.
- Output asset renders in UI.
- Generation/job reaches the correct terminal status.
- Provider/job logging contains useful latency/failure information without secrets.
- No unexplained 4xx/5xx failures.

---

## 🔍 Current repository findings

- `package.json` currently exposes `lint`, `typecheck`, `test`, `test:e2e`, and production `build` scripts. fileciteturn10file0
- `.github/workflows/ci.yml` exists and gates lint, typecheck, unit tests, a worker boundary audit, production build, and Playwright E2E. fileciteturn15file0
- Supabase migrations are present through August 2026, including recent edits/subsystems; migration ordering and production application state still require runtime verification. fileciteturn16file2turn16file3turn16file4turn16file5turn16file6
- The previous roadmap was stale (last updated 2026-06-12) and contained old launch assumptions; this document supersedes those assumptions with the final ten-gate release checklist. fileciteturn12file0

---

## 🚧 Remaining work before Production Complete

1. Run the complete CI/validation suite and record actual results.
2. Execute the critical feature smoke matrix end-to-end with real configured services.
3. Verify auth, billing/credits, provider fallback, worker recovery and idempotency under failure/concurrency cases.
4. Complete the RLS/authorization/storage/rate-limit audit and remediate confirmed findings.
5. Verify production environment/secrets without exposing values and document any missing external configuration.
6. Verify migration state/order and backup/restore readiness against the actual production database.
7. Verify health/readiness/observability and safe production error states.
8. Verify the supported Expo/mobile release path.
9. Resolve every P0/P1 blocker found by the above tests.
10. Re-run everything; only then declare Production Complete.

---

## 📦 Product roadmap after launch

### Next product work — only after the release gates pass

1. Publish the CLI to npm.
2. Finish lifecycle emails.
3. Public render/share pages.
4. User webhooks for render completion.

### Later — don't build until users justify it

- Team workspaces / multi-seat
- White-label / agency mode
- Marketplace for user-submitted workflows
- Real-time Canvas collaboration
- Additional billing providers if Paystack no longer covers target markets

---

## 🛑 Out of scope unless explicitly re-approved

- Anonymous sign-ups
- Hosting our own LLM
- Standalone email-blaster SaaS
- Rejected/removed legacy UI presets

---

## Definition of complete

The old feature-only definition is replaced by the ten production gates at the top of this document. **Feature completeness is necessary but not sufficient; production reliability, security, transaction integrity, recoverability and validated deployment are required.**
