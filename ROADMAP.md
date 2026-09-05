# Aurora — Production Readiness Roadmap

This is the single source of truth for production-readiness status. It
replaces the older feature-shipping roadmap (Lovable/Paystack-era content),
which is now stale — the user-facing "what's live/building/planned" page at
`/roadmap` (`src/routes/roadmap.lazy.tsx`) is a separate, hand-maintained
product page and does not read from this file.

Status legend: ✅ **Verified complete** — checked against live repo/DB
evidence this pass. 🔶 **In progress** — partially addressed, concrete gap
remains. ⛔ **Blocked** — needs something outside this session's tool access
(dashboard config, business decision, paid tier). ⬜ **Remaining** —
identified, not yet started, no blocker.

Last full audit: 2026-08-22. Last update: 2026-09-05 (§10 full gate
re-run, §13 republished, §16 e2e note superseded, §17 referral-credit RPC fix
+ build health gate added, overall readiness score). Prior updates:
2026-08-26 (§16 Aurora Soul integration), 2026-08-24 (§4 redaction sweep,
§8 provider_logs fix, §13 prod server-fn regression, §14 CI gate, §15 blocked
items).

---

## 1. RLS / authorization — ✅ Verified complete (this pass)

Audited all 83 `public` tables' RLS policies and grants live against the
production Supabase project. Found and fixed 5 confirmed exploitable gaps in
`supabase/migrations/20260822160000_lockdown_open_rls_policies.sql`:

- `user_passkeys` / `webauthn_challenges` — a `service_role`-named policy was
  actually scoped to `public`, so any anon caller could read/write any user's
  WebAuthn credentials. Now correctly scoped to `service_role`; `anon`
  revoked.
- `character_profiles` / `storyboards` — an `Open access ...` policy
  (`ALL`/`true`/`true`) let any authenticated user read/edit/delete anyone's
  identity data. Replaced with owner-scoped (`auth.uid() = user_id`)
  policies. Both tables had 0 live rows and no active app read/write path, so
  this closed a live but not-yet-exploited hole.
- `promo_codes` — any authenticated user could list all promo codes
  (including admin-only ones). Dropped; the app already exclusively reads
  this table via the service-role client.
- Bundled hygiene: revoked stale unused `anon` grants on `app_settings`,
  `generation_health_state`, `owner_withdrawals`, `scheduler_heartbeats`,
  `worker_register_attempts` (not independently exploitable — RLS already
  blocked them — but removes an unnecessary grant surface).

Migration is idempotent (verified via a clean re-run) and applied live.
`src/integrations/supabase/types.ts` regenerated afterward.

This builds on prior-session RLS fixes to `boards`/`board_items`/
`chat_threads`/`render_jobs` and the admin-ledger actor-visibility fix
(`src/routes/admin.ledger.lazy.tsx` now shows *who* took each admin ledger
action, not just that an admin did).

`site_content`'s public-read policy was reviewed and is intentional (public
marketing copy) — not a gap.

**Remaining watch item (⬜):** RLS coverage was audited as a point-in-time
snapshot. Any new table needs the same "does it have a migration file AND
correctly-scoped RLS AND minimal grants" three-part check before it ships —
see the memory note on schema-drift discovery for why all three must be
checked independently.

## 2. Rate limiting — ✅ Verified complete (this pass)

Before this pass, the only rate limiter was a per-user in-memory sliding
window (8 calls/60s) on the Video Agent's free "Enhance" and "Cinematic
Analyze" LLM passes. Every credit-charging, provider-calling endpoint was
otherwise unprotected against raw request-rate abuse (separate from the
credit/daily-spend-cap checks, which limit *cost* but not *request rate*).

Extracted the pattern into a shared, reusable limiter
(`src/lib/rate-limit.server.ts`) and applied it to every confirmed
unprotected expensive route:

| Route | Limit |
|---|---|
| `POST /api/public/generate` | 20 / 60s per user |
| `POST /api/public/perform` | 15 / 60s per user |
| `POST /api/video-agent/generate` | 15 / 60s per user |
| `POST /api/video-agent/submit` | 15 / 60s per user |
| `POST /api/adult-admin/generate` | 20 / 60s per user |

All return HTTP 429 with a safe message on trip. In-memory and per-process
by design — a restart resets the window, which is an acceptable tradeoff for
a zero-latency, zero-extra-infra abuse guard; the DB-level credit/daily-cap
checks are the hard financial backstop regardless of request rate.

Standard login/signup/OTP flows are **not** custom-limited because Supabase
Auth already enforces its own built-in rate limits on those endpoints — no
duplicate code needed.

## 3. Storage / signed-URL controls — ✅ Verified complete (documented, no gap found)

Single bucket (`studio`), `public=true` in migrations, but object-level RLS
policies scope insert/update/delete/select to the caller's own first-path
folder (`auth.uid()::text = (storage.foldername(name))[1]`) — verified
consistent across ~15+ call sites. No path-traversal issue found.

Signed URLs are mostly 1h; a few intentionally longer (24h for Spin's
queue-wait UX, 72h for wardrobe/TikTok-remix async flows) — judged
proportionate to their queue-wait use case, not a leftover default.

Because the bucket is `public=true`, anyone with a direct object URL
(`getPublicUrl`) can read it regardless of RLS — this is a known, intentional
tradeoff already documented and not treated as a new finding.

**Remaining watch item (⬜):** object storage itself has no backup/replication
story — see §5.

## 4. Secret / log redaction (error handling) — ✅ Verified complete (2026-08-24)

Two related but distinct concerns, both partially addressed:

**Error message redaction (user-facing endpoints).** Introduced
`src/lib/safe-error.server.ts` — logs the real error server-side, returns a
generic safe message to the client. Applied to the genuinely user-facing
HeyGen Video Agent flow, which was returning raw Postgres/RPC/fetch error
text directly in JSON responses:
- `src/routes/api/video-agent/submit.ts` — credit-reservation RPC errors,
  submission-record-insert errors, and the HeyGen-submit-failure branch (the
  `heygenCredit` classification still runs on the raw message server-side; only
  the string shown to the client is generic).
- `src/routes/api/video-agent/finalize.ts` — HeyGen-poll fetch errors and
  commit-credits RPC errors.
- `src/routes/api/video-agent/status.$videoId.ts` — HeyGen-poll fetch errors.

Zod input-validation messages (describing the caller's own malformed
request) and HeyGen's own status message about the caller's own video were
deliberately left as-is — they're not infrastructure leaks.

**Remaining-routes sweep — done 2026-08-24.** All ten routes flagged in the
previous pass now route client-visible failure text through
`safeErrorMessage()` (raw error still logged server-side):
`src/routes/api/public/gpu/complete.ts`, `gpu/register.ts`,
`free-daily-grant.ts`, `free-monthly-grant.ts`, `payments/sweep-stuck.ts`,
`site-images.ts`, `site-copy.ts`, `workers/register.ts`, `cli/vast.ts`,
`admin/upload-site-image.ts`. Deliberate carve-outs, unchanged: Zod
validation messages (describe the caller's own malformed request);
`worker_register_attempts.error` keeps the raw message (it is the sanctioned
worker-registration diagnostic surface, service-role-read only); the Vast
CLI's `VastGuardrailError` texts (locally generated guardrail messages for
the authenticated owner CLI — never upstream echo). `VastApiError` responses
are **not** carved out: their messages can embed Vast's raw upstream response
body (which for provision calls could echo the worker register secret sent in
the instance env), so the route now logs the raw message server-side and
returns only a bounded HTTP-status summary.

**Repo secret hygiene (found + fixed 2026-08-24):** two pasted script files
in `attached_assets/` contained a live VolcEngine access key. They were
deleted from the working tree and added to the GitHub sync's unconditional
history strip list (their blobs in legacy commits were what GitHub push
protection was blocking — the root cause of the ~9h sync outage on
2026-08-24). **Action item for the owner: rotate that VolcEngine key** — it
must be treated as exposed.

**Other secret handling (verified, no gap found):** SSR-level unhandled
exceptions are already safely caught and replaced with a branded generic
error page (`src/server.ts`, `src/start.ts`, `src/lib/error-page.ts`);
`src/components/ErrorBoundary.tsx` wraps the SPA shell. Client-side
`error-toasts.ts` sanitizes known provider/SQL error dumps but falls back to
the raw message for unrecognized errors in some admin/payment branches — a
smaller-radius version of the same remaining item above.

## 5. Backup / restore / DR docs — 🔶 In progress / ⛔ partially blocked

Wrote `docs/BACKUP_AND_DR.md` — a real runbook covering: what Supabase backs
up automatically vs. what it doesn't (object storage is **not** backed up by
Supabase's DB backups), the step-by-step restore + schema-reconciliation
procedure (tying into the existing migration-collision check in
`docs/DB_MIGRATIONS.md`), and how to re-validate the concurrency/idempotency
invariants against a restored database using the existing `verify-*.sql`
proof scripts.

**⛔ Blocked on dashboard access:** the actual Supabase backup tier/retention
window (Free = none, Pro+ = daily, Team/PITR add-on = continuous) has not
been confirmed — this requires checking **Project Settings → Add-ons →
Backups** in the Supabase dashboard, which isn't reachable from this
workspace's tools. Recorded as an explicit action item in the doc.

**⬜ Remaining:** formal RPO/RTO targets (business decision, not yet set) and
an actual restore drill against a disposable project (never performed, per
the doc's own admission — it establishes the *procedure*, not a
*demonstrated* recovery).

## 6. Health checks — ✅ Verified complete (this pass)

Before this pass: `/api/health` was hardcoded `ok:true` (proves only that the
Node process is up, dependency-blind). `/api/public/uptime-monitor` and
`/api/public/workers/health` do real checking but always return HTTP 200
(status is JSON-body-only), so they can't back a standard infra health-check
probe.

Added `GET /api/ready` (`src/routes/api/ready.ts`) — additive, does not
change `/api/health`'s existing always-200 contract or any maintenance
route's behavior (the cron daemon depends on those staying exactly as they
were). It does a real Supabase round-trip with a 3s budget and returns
**200 only if the dependency check actually succeeds, 503 otherwise** —
suitable for wiring into an external uptime monitor or a deployment
health-check path if/when needed. Verified live: `curl localhost:8080/api/ready`
→ `{"ok":true,"checks":{"database":{"ok":true,"ms":...}}}`.

**⬜ Remaining (optional):** `/api/ready` currently checks DB connectivity
only. A GPU-worker-pool summary could be added as a second check if the team
wants readiness to also reflect generation-capacity health, not just DB
reachability.

## 7. Error handling — ✅ Verified complete (2026-08-24)

See §4 for the redaction half of this (now complete). Separately verified:
the SSR crash boundary and React `ErrorBoundary` are sound (see §4); all
generation-path errors funnel through `error-toasts.ts` with
provider-specific classification (out-of-credit checked before rate-limited,
since Replicate's low-balance error is itself a 429 with "rate limit" in the
text — order matters). `error-toasts.ts`'s unknown-error→raw-message
fallback is a deliberate client-side design choice (the raw text there comes
from responses the server has already sanitized), not a leak path.

## 8. Performance — 🔶 In progress (deliberately not blind-patched)

Audited for unbounded queries and N+1s. Findings, in priority order:

1. **`provider_logs` unbounded read** in `provider-health-check.ts` —
   time-bounded but no row cap, no `(kind, created_at)` index.
2. **`credit_ledger` read-all-then-sum-in-JS** for daily spend in
   `cost-guardrails.server.ts` — the one genuine correctness risk. **Not
   fixed this pass, on purpose:** naively adding `.limit()` to a
   financial-guardrail sum could silently *undercount* a high-volume user's
   true daily spend and let them bypass the cap — worse than the current
   slow-but-correct behavior. Needs dedicated tests before touching.
3. Queue tick processes jobs sequentially, capped at 5/tick — a latency
   characteristic, not a correctness bug; acceptable as-is.
4. Recovery sweeps are already bounded (25 RPCs/tick) — acceptable.
5. Synchronous full-buffer upload up to 200MB in `src/routes/api/audio/upload.ts`
   — real, but a bigger architectural change (streaming) than fits this pass.

**Item 1 — done 2026-08-24.** `provider-health-check.ts` now scans
provider_logs with one bounded query **per monitored kind** (1,000
most-recent rows each — per-kind, not global, so a burst on one kind can
never displace another kind's rows and fake a "no traffic → recovered"
signal; this is health monitoring, not financial aggregation), and migration
`20260824030000_provider_logs_health_scan_index.sql` adds the
`(kind, created_at DESC)` composite index — applied live and recorded in
`schema_migrations` (verified: index present in `pg_indexes`).

**⬜ Remaining:** item 2 needs a dedicated test suite proving an incremental
running-total approach can't undercount before it's touched. Item 5 needs a
streaming-upload design, not a one-line fix.

## 9. Concurrency / idempotency tests — ✅ Verified complete (this pass)

Job claim/finalize races already had both unit tests
(`src/lib/jobs.server.test.ts`) and a live-DB rollback proof
(`scripts/verify-no-double-refund.sql`). Two gaps closed this pass with new
live-DB `BEGIN ... ROLLBACK` proof scripts (same pattern, zero permanent
side effects, both **ran successfully against the live DB**):

- `scripts/verify-idempotency-concurrent-claim.sql` — proves the
  `generation_idempotency_keys` primary key fences a second concurrent claim
  (`23505 unique_violation`), the loser reads the winner's pending row
  instead of double-charging, a late arrival after success sees
  `status='succeeded'` and would replay, and a different key claims
  independently.
- `scripts/verify-concurrent-credit-reservation.sql` — proves
  `reserve_credits()` prevents double-spend when two requests race for the
  same balance (loser gets `false`, balance never goes negative, exactly one
  ledger row), and that the `daily_spend_limit` check's row lock correctly
  rejects a second reservation that would jointly exceed the cap even though
  the raw balance alone could otherwise cover it.

## 10. Final validation — ✅ Verified complete (re-run 2026-09-05)

**2026-09-05 re-run** (after the §17 changes) — every gate green:

- `tsc --noEmit` — clean. `eslint .` — 0 errors, 42 pre-existing warnings.
- `bun test src/` — **1,405 pass / 0 fail**; MCP suite 62 pass.
- `scripts/check-migrations.sh` — OK, 146 migration files, no collisions.
- `scripts/ci/audit-worker-entry.mjs` — OK (`api/public/watchdog.ts` is now
  an explicit, documented Node-only allowlist entry).
- Supabase generated types in sync with the live schema; tutorial PDF fresh.
- Playwright e2e (full suite, 77 tests, 1 worker) — **72 passed / 5 skipped /
  0 failed**. The 5 skips are provider-dependent UGC flows that skip
  themselves when the provider isn't funded. The `aborted` / `ECONNRESET` /
  "h3 swallowed SSR error" log spam during the all-routes crawl is the test
  browser cancelling requests mid-navigation, not route failures.
- Production build — built, passed the built-server health gate (HTTP 200 on
  `/api/health`), promoted to the last-known-good snapshot (see §17).
- Cron/watchdog snapshot: scheduler, queue, site, providers (5 kinds), GitHub
  sync, build restore point all OK. The single self-hosted GPU worker is
  auto-paused (no GPU capacity — infrastructure, not code); the shared API
  budget pool is low (account-level).

Previous run (2026-08-24), kept for history — after the §4 sweep, §8 item 1
and §13 fix:

- `tsc --noEmit` — clean, no errors.
- `eslint .` — 0 errors; 41 pre-existing warnings unchanged.
- `bun test src/` — **1211 pass / 0 fail** across 92 files (5442+
  assertions). The stderr noise in the run (ffmpeg "moov atom not found", a
  Supabase-client TypeError, missing-env-var FATAL logs, etc.) is deliberate
  negative-path test logging — those tests assert on that exact failure
  behavior, not actual failures.
- `scripts/check-migrations.sh` — OK, 126 migration files, no collisions.
- `scripts/ci/audit-worker-entry.mjs` — passed, 20 native imports confined
  to documented Node-only files.
- Full production build (`vite build`) — succeeded; built server boot +
  route/RPC probes verified (see §13).
- `Start application` workflow running clean after all route changes.
- Playwright e2e (full suite, 2026-08-24) — **23 passed / 0 failed** (one
  browser-crash flake during a screenshot, passed on automatic retry). The 6
  failures from the prior pass were fixed in `src/hooks/use-auth.tsx`
  (loading-state now always resolves via `.finally`) without weakening any
  test.

## 11. Sign-in providers — 🔶 Google live / ⛔ Apple dashboard-blocked

**Found 2026-08-23 (user report: sign-in says "provider is not enabled").**
The `/auth` page previously rendered all OAuth buttons unconditionally, so a
disabled provider produced Supabase's "provider is not enabled" error.

**Fixed in-app:** `src/routes/auth.lazy.tsx` now fetches the same public
settings endpoint on mount and only renders OAuth buttons for providers that
are actually enabled. If the settings fetch fails,
it falls back to showing every button rather than hiding a working provider.
No code change is needed later — the moment a provider is switched on or off
in the Supabase dashboard, its button updates automatically.

**Verified live on 2026-09-05:** the public Supabase Auth settings report
`google: true` and `apple: false`. The sign-in page therefore offers Google
alongside the already-enabled email/password, GitHub, and passkeys.

**Remaining dashboard action:** Apple sign-in still requires enabling the
provider under **Authentication → Providers** with an Apple Developer
account, Services ID, and signed client secret key. Google is no longer a
roadmap blocker.

## 12. Lifecycle emails — ✅ Configured and verified

Interpreting “lifetime emails” as the existing lifecycle-email system, the
delivery path is now wired into the managed `cron` workflow:

- `RESEND_API_KEY` is configured.
- The daemon calls `POST /api/public/lifecycle-emails` every 6 hours using the
  shared cron credential.
- The endpoint uses the same `authorizeCron` guard as the other scheduled
  routes; it no longer requires the privileged Supabase service-role key in a
  scheduler request.
- Each email is logged in `email_log` and deduplicated by the template's
  cooldown/window: re-engagement, first-purchase nudge, onboarding resume,
  weekly digest, and daily creative tip.
- A live scheduled run on 2026-08-23 was accepted successfully by Resend:
  15 re-engagement, 27 first-purchase, 3 onboarding-resume, 1 weekly-digest,
  and 9 daily-tip messages.
- The run safely skipped 1,517 stale profile records whose auth users no
  longer exist, preserving the `email_log.user_id` foreign-key guarantee
  instead of aborting the entire batch.

The sender defaults to
`Aurora Studio <noreply@auroraperformancestudio.com>`; set
`AURORA_FROM_EMAIL` if a different verified Resend sender is preferred.

## 13. Production build server-fn regression — ✅ Fixed 2026-08-24, republished 2026-09-05

**Symptom:** the live site's feature routes (`/spin`, `/ugc`, …) returned
HTTP 500 (a `hidden` destructuring TypeError) while dev worked fine. Every
server function and SSR loader in the production build resolved `undefined`.

**Root cause:** a 2026-08-20 change marked `@tanstack/react-start/server`,
`@tanstack/react-start-server`, and `@tanstack/start-server-core` as
production `ssr.external` (to work around a "createRequestHandler unbound"
build issue). Externalizing `start-server-core` makes Nitro bundle it from
`node_modules` outside the Start plugin pipeline, where its
`#tanstack-start-server-fn-resolver` subpath import resolves to the
package's built-in **no-op resolver** instead of the generated server-fn
manifest — so `getServerFnById()` returns nothing, for every function.

**Fix:** removed the `ssr.external` block from `vite.config.ts` (with an
explanatory comment so it can't be reintroduced blind). The original
"createRequestHandler unbound" problem no longer reproduces.

**Verified on the rebuilt output (`.output/`):** server boots; `/`, `/spin`,
`/ugc`, `/kids`, `/content-machine`, `/avatar` all 200; a real
`/_serverFn/<id>` RPC probe (id extracted from the built manifest) returns a
correctly serialized response (a proper "Unauthorized" business error for an
unauthenticated call — exactly right); the fake resolver is absent from the
emitted bundle.

~~⚠️ The currently published deployment still runs the broken build — it
needs a republish to pick up this fix.~~ **Republished** — the deployment
that went out 2026-09-05 carries this fix; the flag is cleared.

## 14. CI production gate — ✅ Added (2026-08-24)

`npm run production:gate` chains the full pre-deploy validation: lint →
typecheck → `bun test src/` → migration-collision check → worker-boundary
audit → production build. `.github/workflows/ci.yml`'s quality job now runs
it as a single step, so CI enforces the same gate documented here. Each
component step was executed green on 2026-08-24 (see §10).

## 15. Explicitly blocked items — ⛔ (outside this workspace's tool access)

- **Supabase backup drill (§5):** confirming the backup tier/retention and
  performing a restore drill require the Supabase dashboard and a disposable
  project — owner action.
- **iOS signing / App Store submission:** requires a paid Apple Developer
  account and signing credentials that cannot be provisioned from this
  workspace.
- **GitHub Actions billing:** CI runs depend on the repo owner's Actions
  billing/quota state on GitHub — if the quota is exhausted, the `ci.yml`
  gate silently won't run; owner must check GitHub → Settings → Billing.
- **Google/Apple OAuth (§11):** Supabase dashboard provider enablement with
  real credentials — owner action.

## 16. Aurora Soul integration — 🔶 Live, two provider blockers (2026-08-26)

Ported the character-consistency ("Soul") feature from the `josephcrown920/soulmagic`
reference repo (audited HEAD `66588b18…`) into Aurora as a native, lazy-isolated
feature boundary — not a separate app, not a separate billing provider.

**Live and verified this pass:**
- Routes `/soul`, `/soul/train`, `/soul/library`, `/soul/generate`,
  `/soul/generate/video`, `/soul/vibe` — all lazy-loaded, wrapped in `SoulShell`
  (`src/features/soul/soul-shell.tsx`), which gates on `useFeatureVisibility()`
  with a branded skeleton / access-denied / signed-out state (fail-closed, never
  renders null). Nav entry added to `MobileNav.tsx`; `soul` feature key defaults
  hidden in `feature-visibility.ts` until explicitly turned on for a cohort.
- DB migrations `20260826180000_soul_tables.sql` and
  `20260826180100_soul_storage_buckets.sql` — applied live (verified via
  `supabase_migrations.schema_migrations`). Three owner-only-RLS tables
  (`souls`, `soul_reference_assets`, `soul_video_jobs`) with default anon/DDL
  grants revoked, matching the §1 RLS pattern. Two private storage buckets
  (`soul-training`, `soul-generated`) with own-folder-only policies — reads are
  always short-lived signed URLs, never `getPublicUrl`. `types.ts` regenerated
  from the live schema afterward.
- `src/lib/soul.server.ts` — LoRA training kickoff (`fal-ai/flux-lora-portrait-trainer`
  via `FAL_KEY`), identity-locked image generation (`fal/soul-lora` → fal's
  `flux-2/lora`), stale-training detection (45 min), and the free Vibe Matcher
  (Aurora's own text/vision LLM gateway, not Lovable AI Gateway — no credit
  charge, analysis only). All CRUD and generation entry points are
  ownership-guarded. Image/video generation go through `reserveOrchestrateRecord`
  (reserve → commit on success / release on failure), the same pattern as
  every other Aurora generation path. Training has no `generations` row to
  attach a charge to, so it prices a flat `SOUL_TRAINING_COST` (`pricing.ts`)
  and reserves/commits/releases directly against `reserve_credits` /
  `commit_reservation` / `release_reservation` — reserved before the fal call,
  committed once fal accepts the job (real compute spend starts then,
  regardless of the eventual training result), released on any failure before
  or during that call. A stale-training retry re-reserves fresh credits, same
  principle as re-enqueuing a failed render job. The fal trainer request also
  now carries the soul's `trigger_word`, so the trained LoRA actually learns
  the token every inference prompt is prefixed with — no parallel billing
  system introduced.
- `src/routes/api/soul/fal-webhook.ts` — thin dispatcher; verification logic
  lives in `src/lib/soul-fal-webhook.server.ts` (Ed25519 signature over
  fal's published JWKS, 5-minute replay window, optional `?secret=` gate via
  `SOUL_FAL_WEBHOOK_SECRET`) so it's unit-testable in isolation, mirroring the
  existing `paystack-webhook.server.ts` split.
- Pricing: `soul_image` billed at the existing Flux-identity-still rate;
  `soul_video` billed via a new `seedance-soul` model key at the `ultra` video
  tier — both flow through `src/lib/pricing.ts`'s single cost source, no
  hardcoded rates.
- Tests: `src/lib/soul.server.test.ts` and
  `src/lib/soul-fal-webhook.server.test.ts` (stale-training detection, Vibe
  Matcher JSON tolerance/fallback, and full webhook verification — missing
  headers, replay/stale timestamp, invalid signature, JWKS-unavailable → 503
  not 401, and the `?secret=` gate — against a real generated Ed25519 key
  pair, no reliance on fal's live endpoint). Full suite green
  (1258/1258, `bun test src/`), `tsc --noEmit` clean, `eslint` clean (0
  errors).

**Blocked / not yet connected (explicit, not silently working):**
- ⛔ **Soul video generation is non-functional in production** — as of
  2026-09-05 `SEEDANCE_API_KEY` is set but `SEEDANCE_API_URL` is not, and no
  Seedance model is activated on the BytePlus/ModelArk account (Ark Console
  unlock — see the Model Watch scan). `generateSoulVideo` throws an explicit
  configuration error rather than silently falling back to another provider;
  `/soul/generate/video` surfaces that error to the user instead of hanging.
  Tracked as the "Turn on Soul video generation once Seedance access is set
  up" project task.
- ⛔ **fal training webhook has no configured secret** — `SOUL_FAL_WEBHOOK_SECRET`
  is unset, so the `?secret=` gate is currently a no-op and Ed25519/JWKS
  verification is the only line of defense (still correct and enforced, but
  the extra defense-in-depth layer isn't active until the secret is set).
- ⬜ **Wan 2.2 character animation** and **GFPGAN/Codeformer video post-processing**
  from the soulmagic source repo were explicitly out of scope for this pass
  (documented in the task spec) — not started, no code path exists yet.
- ⬜ **Playwright end-to-end journey** (sign in → train → generate → download)
  has still not been written. The blocker recorded on 2026-08-26 (the broader
  `test:e2e` suite failing across nearly all specs) is **resolved** — the
  suite is 72/77 green as of 2026-09-05 (§10) — so a Soul-specific journey
  would now produce a trustworthy signal; it just hasn't been added yet.

**Readiness: 70/100** — core train/generate/library/vibe flow is live,
credit-safe, and RLS-hardened, but the headline video-generation path needs
two secrets set before end users can actually render a Soul video, and no
live e2e proof exists yet.

## 17. Re-verification pass — ✅ 2026-09-05

Findings and changes from the full production-readiness re-check:

- **Referral / affiliate credit grants were silently failing.** The live DB
  carried both a 4-arg and a 5-arg `grant_credits` overload, so PostgREST
  could not disambiguate the RPC and every non-admin grant (referral rewards,
  lipsync refunds, Paystack top-ups, studio/spin/promo credits) errored.
  Fix: every non-admin caller now passes `_actor: null` explicitly;
  `supabase/migrations/20260905163000_drop_legacy_grant_credits_overload.sql`
  drops the 4-arg overload; `src/lib/grant-credits-rpc.test.ts` pins the
  contract. **Follow-up (⬜, owner-visible):** confirm a real referral reward
  lands after a fresh sign-up on the published site.
- **Build → health gate → last-known-good promotion.** `scripts/build.js`
  (via `scripts/health-gate.mjs`) now boots the freshly built server, probes
  `/api/health`, and only then
  promotes the output to the last-known-good snapshot; `scripts/start-prod.sh`
  falls back to that snapshot if a new build fails the gate. Fail-closed by
  design — a broken build can no longer replace a working one.
- **SSR error normalization + `/health` startup short-circuit** in
  `src/server.ts` (covered by `src/server.test.ts`): catastrophic SSR errors
  are normalized to a proper 5xx instead of leaking, and the health probe
  answers before the router is warm so the deploy health check never
  false-fails on cold start.
- **Landing CTA hierarchy:** one primary "Start creating" in the hero, the
  duplicate anonymous header CTA removed, contextual labels elsewhere.
  Director's Room tools live only in `DirectorRoomRail.tsx` (duplicates
  removed from `MobileNav.tsx`, the real nav).
- **Hero photo crop on phones:** the lead slide's subject sits flush against
  the photo's right edge, so a centred `object-cover` on tall phone
  viewports cut the face in half (fine on laptops). Slides now carry an
  optional `focus` object-position; verified at 390×844 and 1366×768.
- Orphaned Playwright/Vite process on port 8080 was the cause of a workflow
  port failure — infrastructure, not code.

**Not code — needs owner / provider action:** self-hosted GPU worker paused
for lack of GPU capacity; shared API budget pool low; two HeyGen jobs in
retry after "HeyGen video failed: unknown" (provider-side); Seedance model
activation for Soul video (§16); everything in §15.

---

## Overall readiness — 85/100 (2026-09-05)

Everything the codebase controls is done and re-verified green: RLS,
rate limiting, storage scoping, redaction, health gates, concurrency /
idempotency proofs, CI gate, lifecycle emails, the build protection onion,
and the full unit + e2e + production-build gate. The remaining ~15 points
are all outside the code and all owner/provider actions: a demonstrated
Supabase restore drill (§5), Google/Apple sign-in credentials (§11), GPU
capacity for the self-hosted worker, provider funding, and Seedance
activation for Soul video (§16). The two deliberately-deferred performance
items (§8 items 2 and 5) are correctness-safe as they stand.

## Summary scorecard

| Area | Status |
|---|---|
| 1. RLS / authz | ✅ Verified complete |
| 2. Rate limiting | ✅ Verified complete |
| 3. Storage / signed URLs | ✅ Verified complete (no gap found) |
| 4. Secret / log redaction | ✅ Verified complete (2026-08-24) |
| 5. Backup / restore / DR docs | 🔶 Runbook done / ⛔ drill blocked (owner) |
| 6. Health checks | ✅ Verified complete |
| 7. Error handling | ✅ Verified complete (2026-08-24) |
| 8. Performance | 🔶 Item 1 fixed; items 2 & 5 deliberately deferred |
| 9. Concurrency / idempotency tests | ✅ Verified complete |
| 10. Final validation | ✅ Re-verified 2026-09-05 — 1,405 unit / 72 e2e / prod build green |
| 11. Sign-in providers | 🔶 Google enabled and surfaced; ⛔ Apple still needs dashboard enable |
| 12. Lifecycle emails | ✅ Configured and verified |
| 13. Prod server-fn regression | ✅ Fixed 2026-08-24, republished 2026-09-05 |
| 14. CI production gate | ✅ Added 2026-08-24 |
| 15. Blocked items | ⛔ Backup drill, iOS signing, GH Actions billing, OAuth providers |
| 16. Aurora Soul integration | 🔶 Live (70/100) — video needs Seedance URL + model activation |
| 17. Re-verification pass | ✅ 2026-09-05 — referral RPC fix, build health gate, hero crop |
| **Overall** | **85/100** — code complete; remaining points are owner/provider actions |

## Historical feature roadmap

The pre-2026-08-22 version of this file tracked feature shipping status
(Studio, Canvas, Lipsync, UGC ads, CLI, billing, etc.) under a Lovable/
Paystack-era stack description that no longer matches the live app (Supabase
+ Replicate/fal/HeyGen, not Lovable AI Gateway + Paystack-only). That
feature-shipping view now lives, hand-maintained and always current, at the
in-app `/roadmap` page (`src/routes/roadmap.lazy.tsx`) — this file is
reserved for production-readiness tracking going forward and should not
duplicate that page's content.
