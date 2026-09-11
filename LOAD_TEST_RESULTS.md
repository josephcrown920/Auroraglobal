# Aurora 100+ Concurrent User Load Test

## Scope and safety

**Status: incomplete / blocked on an approved authenticated load run.**
No claim of successful 100-user generation capacity is made by this report.

The safe k6 suite ramps to 110 concurrent virtual users and exercises generation,
job-status routing, GPU-worker health routing, and the Paystack webhook. The
production baseline uses only rejection/read-only paths: it does not authenticate
generation, sign webhook payloads, invoke the worker sweep, grant credits, or
dispatch a provider.

For controlled staging accounts, provide 110 distinct users. Billable
generation remains disabled unless both `FUNCTIONAL_MODE=true` and
`ALLOW_BILLABLE_GENERATION=true` are explicitly set and
`APPROVED_FUNCTIONAL_BASE_URL` exactly matches `BASE_URL`. For the full sign-in
flow, inject `LOAD_TEST_USERS_JSON` through Secrets (an array of 110 distinct
email/password objects), plus `LOAD_TEST_SUPABASE_URL` and
`LOAD_TEST_SUPABASE_PUBLISHABLE_KEY`. Each VU signs in, checks `/api/balance`,
submits through `/api/generate`, and polls `/api/jobs/:id/status`.
`AUTH_TOKENS` optionally supplies 110 distinct test bearer tokens instead;
that mode explicitly skips sign-in and must not be reported as an auth benchmark.

Safe production baseline:

```sh
BASE_URL=https://auroraperformancestudio.com \
  SUMMARY_EXPORT=LOAD_TEST_RESULTS.raw.json \
  k6 run scripts/load-test.js
```

Functional staging run (requires controlled, funded staging users):

```sh
BASE_URL=https://staging.example \
  APPROVED_FUNCTIONAL_BASE_URL=https://staging.example \
  FUNCTIONAL_MODE=true \
  ALLOW_BILLABLE_GENERATION=true \
  SUMMARY_EXPORT=load-test-functional-summary.json \
  k6 run scripts/load-test.js
```

Supply the account JSON and Supabase settings via environment/Secrets, not
inline shell arguments or committed files. Never enable HTTP debug output with
real credentials.

Functional mode starts 110 VUs with one iteration each (12-minute ceiling),
uses a unique run ID in every idempotency key, and submits at most one text
generation per VU. It requires exactly 110 submissions and 110 recorded
outcomes, at least 105 terminal successes, and a success rate above 95%.
Polling stops at 10 minutes. Malformed responses, HTTP errors (including 429),
failed terminal states, and unfinished iterations fail the run. This bounds the
number of paid calls, not their monetary cost; fund test accounts to an approved
budget before running. Text generation does not stress the GPU job queue.

## Baseline

Run on 2026-09-09 against `https://auroraperformancestudio.com`:

| Metric | Result |
| --- | ---: |
| Peak virtual users | 110 |
| Completed rejection-probe iterations (not authenticated user flows) | 5,661 |
| Interrupted iterations | 0 |
| Requests | 23,822 |
| Overall latency p50 / p95 / p99 | 116.7 / 690.7 / 979.7 ms |
| Generation latency p50 / p95 / p99 | 114.8 / 785.5 / 1,011.5 ms |
| Job-status latency p50 / p95 / p99 | 119.2 / 653.8 / 952.0 ms |
| Worker-health latency p50 / p95 / p99 | 118.0 / 606.8 / 937.0 ms |
| Webhook latency p50 / p95 / p99 | 113.2 / 610.5 / 960.2 ms |
| Legacy callback-classified HTTP failure rate (not reliable) | 0% |
| Application-flow error rate | 25% |

The latency targets passed, but the run intentionally failed its application
threshold: all 5,661 unauthenticated generation calls returned HTTP 500 instead
of HTTP 401. A single-request reproduction returned the same 500, proving this
was not saturation. The remaining three primary probes returned their accepted
security/routing statuses and no iterations were interrupted.
The legacy callback accepted unexpected statuses, making its 0% HTTP failure
rate misleading. The observed 5,661 generation 500s alone represent 23.76% of
all requests. The current script uses endpoint-specific expected statuses and
rejects unexpected generation and job-status responses. Worker-health GET
expects 200; the separate health sweep is an authenticated POST. The raw
baseline is historical data from the earlier script, not evidence for the
corrected one.

## Fresh safe production run — 2026-09-10

This run used the corrected safe probe, at 110 peak VUs, against the currently
published URL. It did not authenticate, submit a generation, spend Aura, or
touch the GPU queue.

| Metric | Result |
| --- | ---: |
| Peak virtual users | 110 |
| Completed safe probe iterations | 6,076 |
| Interrupted iterations | 0 |
| Requests | 25,566 |
| Overall latency p50 / p95 / p99 | 112.5 / 515.6 / 1,156.4 ms |
| Generation-probe latency p50 / p95 / p99 | 111.7 / 690.1 / 1,161.3 ms |
| Job-status latency p50 / p95 / p99 | 115.0 / 464.4 / 1,153.0 ms |
| Worker-health latency p50 / p95 / p99 | 113.5 / 462.6 / 1,159.7 ms |
| Webhook latency p50 / p95 / p99 | 108.8 / 445.8 / 1,149.2 ms |
| Application-flow error rate | 28.70% |

Latency thresholds passed and no iterations were interrupted. The flow
threshold failed because the published app is still the previous build:
unauthenticated generation probes returned `500` and job-status probes
returned `404`; worker-health returned `200` and the unsigned webhook returned
`401`. Local source verification after the fixes returns `401`, `401`, `200`,
and `401` for those same four routes.

The raw summary is saved as `LOAD_TEST_RESULTS.latest.raw.json`. This is
rejection-path evidence, not authenticated generation or GPU-capacity
evidence.

## Post-fix verification

The top-level server now rejects a missing generation bearer token before the
TanStack route graph/module load, directly fixing the observed live failure mode.
The handler test confirms HTTP 401 and confirms the route graph is never invoked.
The full production post-fix load run must follow publication of the current
source. Publishing is user-initiated in Replit; the current published build
has not yet been replaced, so this report does not claim that the live app is
fixed.

Continuation checks: k6 validates both scenarios when options are supplied with
`k6 inspect -e FUNCTIONAL_MODE=true scripts/load-test.js`. The billable safety
guard was executed and rejected an unapproved run before any network traffic.
Unit coverage exercises the real script with synthetic transport responses:
failed submissions, malformed JSON, failed terminal states, exceptions, successful
polling, distinct-user requirements, and exact outcome-count thresholds.
These are methodology tests, **not** load evidence.

The repository production build passed through the configured 4.6 GB heap
build command. The ordinary `npm run build` was killed by the container
memory limit after transforming 4,545 modules; this is an environment
limitation, not a source build failure.

The existing Playwright E2E workflow was blocked by `ENOSPC` while watching
`artifacts/aurora-adult`; it is unrelated to the load-test route changes.

## Code review findings

- The queue already has partial/composite indexes for queued claims, processing
  lock recovery, failed recovery, unsettled reservations, and user history.
  No redundant index was added.
- `/api/public/generate` already has a per-user limiter. A bounded pre-router,
  per-IP token bucket now protects public generation, webhook, and worker-health
  surfaces before route/module work. Arbitrary credential headers do not bypass it.
- Authenticated `GET /api/balance` and `GET /api/jobs/:id/status` routes provide
  bounded, ownership-scoped reads for the functional test (one profile query or
  two job/generation lookups, plus auth verification). `/api/generate`
  routes to the canonical public generation handler, which now returns its
  generation ID for polling.
- The complete API route promise is registered with `ctx.waitUntil()` when the
  runtime provides it. Critical payment and queue finalization stays awaited, so
  Aurora never acknowledges a webhook or cron tick before durable work finishes.

## Remaining risks

- The token bucket is isolate-local. It blunts bursts but is not a global quota
  across autoscaled instances; authenticated credit and database controls remain
  the authoritative safeguards.
- Deployment client-IP trust remains unverified. The limiter currently keys on
  `cf-connecting-ip`; Replit documents `x-forwarded-for` for its ingress.
  Verify which header the actual ingress overwrites before publishing this
  limiter. With no CF header all callers share the fallback bucket; trusting a
  spoofable header permits evasion. Do not interpret this as validated protection.
- A destructive, fully authenticated production run was intentionally not used:
  it would spend Aura and fan out to paid/shared providers. Use a staging account
  with distinct tokens and explicit opt-in for that mode. The checked-in raw
  baseline summary is `LOAD_TEST_RESULTS.raw.json`; the latest safe run is
  `LOAD_TEST_RESULTS.latest.raw.json`.