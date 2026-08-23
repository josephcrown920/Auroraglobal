# Observability and alerting

Aurora has three layers of operational visibility:

1. structured workflow logs from the cron daemon for queue ticks, worker health,
   provider health, deletion sweeps, balance checks, and GitHub sync;
2. application error capture in `src/lib/error-capture.ts`, including the
   original error recovered when TanStack/h3 converts an SSR exception into a
   generic 500 response;
3. per-request API logging into the `api_logs` table, visualized at
   `/admin/observability`.

The server also has an optional dependency-free Sentry bridge. Set
`SENTRY_DSN` as a server secret to send SSR and middleware exceptions as Sentry
envelopes. When the variable is absent, the bridge is a no-op and local logs
remain unchanged. No DSN or secret is committed to the repository.

## API request logging (`api_logs`)

Every request under `/api/**` is logged once, centrally, from the single
top-level `fetch` handler in `src/server.ts` — not from per-route code — so
every current and future API route is covered automatically. The actual
insert is fire-and-forget (`src/lib/api-logger.server.ts`): it never throws
and never delays the response it's describing.

Each row records `endpoint`, `method`, `status`, `response_time_ms`, `ip`,
`user_agent`, and a `source` classification:

- `internal` — traffic to the scheduler's own endpoints (`/api/public/jobs/tick`,
  `/api/public/workers/health`) or from a loopback IP;
- `bot` — a user-agent that matches common crawler/script signatures;
- `real` — everything else.

Like `gpu_workers.auth_token`, `api_logs` has RLS enabled with **no policies**
and grants revoked from `anon`/`authenticated` — only the service-role client
used server-side can read or write it.

`/admin/observability` (admin-gated, see `src/lib/admin-observability.functions.ts`)
reads the last 24h (capped at 20,000 rows) and shows: top endpoints by volume,
requests per hour, p95 latency per endpoint, and error rate per endpoint. Pure
aggregation logic lives in `src/lib/api-observability-stats.ts` so it's
unit-testable without a live database.

## Product analytics (PostHog)

Optional, consent-gated PostHog wiring lives in `src/lib/posthog.ts`. It is a
no-op until `VITE_POSTHOG_KEY` is set (see `docs/ENV.md`) and only fires after
the visitor has accepted the same cookie-consent decision that gates GTM (see
`src/lib/consent.ts`). `capture_pageview` is disabled in `posthog.init` because
route changes are client-side navigations, not full page loads — `usePageViewTracking()`
(`src/hooks/use-tracking.ts`) calls `capturePageView()` manually on every route
change, alongside the existing first-party `events` table tracking.

## What to monitor

- repeated non-200 responses from `/api/public/jobs/tick`;
- worker health moving from active to paused/draining;
- `queue.distressed` in the uptime-monitor result;
- repeated deletion-sweep failures;
- provider-health checks reporting zero successes for a generation kind;
- Sentry error volume and new issue alerts when `SENTRY_DSN` is enabled.

The cron workflow is the current alert transport and uses the existing
operator email configuration. Any new scheduled endpoint must use the same
authenticated route pattern and emit a machine-readable JSON result.