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

Last full audit: 2026-08-22. Last update: 2026-08-23 (§11 sign-in providers).

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

## 4. Secret / log redaction (error handling) — 🔶 In progress

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

**⬜ Remaining (lower priority, lower exposure):** the same raw-message
pattern exists on admin/worker/CLI-authenticated routes audited this pass —
`src/routes/api/public/gpu/complete.ts`, `gpu/register.ts`,
`free-daily-grant.ts`, `free-monthly-grant.ts`, `payments/sweep-stuck.ts`,
`site-images.ts`, `site-copy.ts`, `workers/register.ts`, `cli/vast.ts`,
`admin/upload-site-image.ts`. These are not exposed to arbitrary
unauthenticated users the way the Video Agent endpoints were, so they were
consciously deprioritized this pass rather than fixed blind.

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

## 7. Error handling — 🔶 In progress

See §4 for the redaction half of this. Separately verified: the SSR crash
boundary and React `ErrorBoundary` are sound (see §4); all generation-path
errors funnel through `error-toasts.ts` with provider-specific classification
(out-of-credit checked before rate-limited, since Replicate's low-balance
error is itself a 429 with "rate limit" in the text — order matters).

**⬜ Remaining:** the admin/worker/CLI raw-error-message routes listed in §4.

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

**⬜ Remaining:** add the `(kind, created_at)` index and a sane row cap to
item 1 (safe, no correctness tradeoff — do this first if picking performance
work back up). Item 2 needs a dedicated test suite proving an incremental
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

## 10. Final validation — ✅ Verified complete (this pass, as of last edit)

- `npx tsc --noEmit` — clean, no errors.
- `npx eslint` (touched files, and full-repo baseline previously) — 0 errors;
  41 pre-existing warnings unchanged.
- `bun test src/` — **1210 pass / 0 fail** across 92 files (5519 assertions).
  The stderr noise in the run (ffmpeg "moov atom not found", a Supabase-client
  TypeError, missing-env-var FATAL logs, etc.) is deliberate negative-path
  test logging — those tests assert on that exact failure behavior, not
  actual failures.
- `Start application` workflow restarted clean after all route changes;
  `/api/health` and the new `/api/ready` both verified live via curl.
- `test:e2e` — not re-run this pass; last known status was a pre-existing,
  unrelated `webServer` boot-timeout issue, not a regression introduced by
  this session's changes.

## 11. Sign-in providers — 🔶 Fixed in-app / ⛔ enabling more providers is dashboard-blocked

**Found 2026-08-23 (user report: sign-in says "provider is not enabled").**
The live Supabase project (checked via its public `/auth/v1/settings`
endpoint) has only **email/password, GitHub OAuth, and passkeys** enabled.
Google and Apple OAuth are **disabled** at the Supabase level, but the
`/auth` page rendered all three OAuth buttons unconditionally — so clicking
"Continue with Google" or "Continue with Apple" always failed with
Supabase's "provider is not enabled" error.

**Fixed in-app:** `src/routes/auth.lazy.tsx` now fetches the same public
settings endpoint on mount and only renders OAuth buttons for providers that
are actually enabled (currently: GitHub only). If the settings fetch fails,
it falls back to showing every button rather than hiding a working provider.
No code change is needed later — the moment a provider is switched on in the
Supabase dashboard, its button reappears automatically.

**⛔ Blocked on dashboard access (manual owner action):** actually offering
Google/Apple sign-in requires enabling each provider in the Supabase
dashboard (**Authentication → Providers**) with real credentials:
- **Google:** an OAuth client ID/secret from Google Cloud Console, with the
  Supabase callback URL registered.
- **Apple:** an Apple Developer account (paid), a Services ID, and a signed
  client secret key.

Until then, the sign-in page correctly offers email/password, GitHub, and
passkeys only.

---

## Summary scorecard

| Area | Status |
|---|---|
| 1. RLS / authz | ✅ Verified complete |
| 2. Rate limiting | ✅ Verified complete |
| 3. Storage / signed URLs | ✅ Verified complete (no gap found) |
| 4. Secret / log redaction | 🔶 In progress |
| 5. Backup / restore / DR docs | 🔶 In progress / ⛔ partially blocked |
| 6. Health checks | ✅ Verified complete |
| 7. Error handling | 🔶 In progress |
| 8. Performance | 🔶 In progress (deliberate) |
| 9. Concurrency / idempotency tests | ✅ Verified complete |
| 10. Final validation | ✅ Verified complete |
| 11. Sign-in providers | 🔶 Fixed in-app / ⛔ Google & Apple need dashboard enable |

## Historical feature roadmap

The pre-2026-08-22 version of this file tracked feature shipping status
(Studio, Canvas, Lipsync, UGC ads, CLI, billing, etc.) under a Lovable/
Paystack-era stack description that no longer matches the live app (Supabase
+ Replicate/fal/HeyGen, not Lovable AI Gateway + Paystack-only). That
feature-shipping view now lives, hand-maintained and always current, at the
in-app `/roadmap` page (`src/routes/roadmap.lazy.tsx`) — this file is
reserved for production-readiness tracking going forward and should not
duplicate that page's content.
