# Aurora — Production Readiness Roadmap

This is the single source of truth for production-readiness status.

**Current audit: 2026-09-01**  
**Current readiness estimate: 82/100 — Release Candidate, not certified production-ready.**

Status legend: ✅ Verified complete · 🔶 In progress · ⛔ Blocked outside repository access · ⬜ Remaining.

> Historical test results certify the commit/environment that produced them. They do not certify later commits. Current release claims require current GitHub evidence.

## 1. Security / authorization — ✅ Verified

RLS/grants, storage ownership controls, authorization gaps, and server-side error redaction were audited and fixed in the existing security pass. The lockdown migration was applied live according to prior audit evidence.

**Owner action:** rotate the VolcEngine credential previously found in repository assets. Removal from the tree does not make an exposed credential safe.

## 2. Rate limiting — ✅ Verified

Shared per-process limits cover confirmed expensive generation/provider routes. Database credit and daily-spend controls remain the financial backstop.

## 3. Storage — ✅ Verified

Studio object policies enforce user-folder ownership for mutations. Public object URLs remain an intentional tradeoff. Object-storage backup remains part of DR planning.

## 4. Error handling / redaction — ✅ Verified

User-facing infrastructure/provider failures are sanitized while raw diagnostics remain server-side. SSR and SPA crash boundaries are present.

## 5. Backup / disaster recovery — 🔶 In progress / ⛔ partially blocked

`docs/BACKUP_AND_DR.md` documents backup scope and restore procedure.

Still unproven: actual Supabase backup tier/retention, formal RPO/RTO, disposable-project restore drill, and an operational object-storage backup/replication plan.

## 6. Health / readiness — 🔶 Implemented; current live verification required

`GET /api/ready` performs a real Supabase dependency check and now includes GPU-pool readiness. It reports the number of active, healthy, and stale/failed GPU workers and returns 503 when the database is unavailable or a configured GPU pool has no healthy worker with a recent successful probe. A pool with no active workers is reported as `not_configured` and does not block application readiness.

The readiness endpoint intentionally consumes the latest worker-health sweep state rather than probing GPU workers inline, avoiding slow/flaky deployment health checks and avoiding mutations from a GET request.

## 7. Concurrency / idempotency — ✅ Verified

Live rollback proofs cover concurrent idempotency claims, credit reservation, double-spend protection, job claim/finalize races, and daily-cap locking.

## 8. Performance / financial guardrails — 🔶 In progress

Provider-log health scanning is bounded and indexed.

A PostgreSQL aggregate/RPC implementation for daily-spend calculation has been added to GitHub to avoid read-all-then-sum-in-JS. **Live Supabase application of that migration still needs verification.**

The audio upload path still buffers up to 200 MB. Streaming is an architectural optimization unless production load demonstrates unacceptable behavior.

## 9. CI / dependency isolation — 🔶 In progress

The GitHub pipeline previously contained Replit-specific dependency/runtime assumptions. Current `Main` has removed the known Replit package-install and Playwright PID-helper blockers, pins npm, installs FFmpeg for the production gate, and isolates Bun test files to prevent global mock/environment/fetch leakage.

**Current validation is still required to prove the complete gate is green.**

## 10. E2E stability — 🔶 In progress

Playwright uses one worker, 60-second test timeout, 10-second expect timeout, one retry, failure screenshots, and retained traces. The previous failure occurred before browser tests because of Replit-specific server startup. The startup path has been changed to GitHub-native Node/Vite execution.

**Not yet proven:** a completed authenticated Playwright run against the production-like Supabase environment.

## 11. AI / provider integrations — 🔶 In progress

Provider routing/fallback infrastructure, Replicate integration, and the native Soul/Seedance orchestration boundary are present.

Live generation depends on required production provider secrets/configuration. Missing CI credentials must be distinguished from application regressions.

## 12. Production build / application gate — 🔶 In progress

`production:gate` covers lint, TypeScript, unit tests, migration checks, worker-entry auditing, and the production build. The August clean result is historical; September certification requires the current pipeline.

## 13. Current release blockers

### 🔴 Must resolve before certification

1. Current GitHub production gate passes on the latest `Main` commit.
2. Critical authenticated Playwright E2E completes successfully.
3. Daily-spend RPC/migration is verified live in Supabase.
4. Exposed VolcEngine credential is rotated.
5. Required production provider secrets/configuration are confirmed, including Seedance/Soul.

### 🟡 Operational readiness

6. Confirm Supabase backup tier/retention.
7. Establish RPO/RTO.
8. Perform a disposable restore drill.
9. Confirm production deployment is serving the audited `Main` commit.

## 14. Not currently launch blockers

- 200 MB audio buffering/streaming optimization unless load testing demonstrates unacceptable behavior.
- Cosmetic refactors.
- Non-critical performance cleanup.
- Providers outside the launch scope.

## 15. Marketing Studio — ⬜ Planned product capability

### Goal

Add a first-class **Marketing Studio** inside Aurora for turning generated creative/assets into social-ready advertising campaigns without requiring the user to leave Aurora.

### Core workflow

**Asset / project → campaign brief → platform variants → generated creatives → review → export/download → ad-ready package.**

### Initial platforms

- Instagram
- Facebook
- TikTok
- YouTube Shorts
- X

### Asset types

- Feed posts
- Story/Reel vertical creatives
