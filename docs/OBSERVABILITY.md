# Observability and alerting

Aurora has two layers of operational visibility:

1. structured workflow logs from the cron daemon for queue ticks, worker health,
   provider health, deletion sweeps, balance checks, and GitHub sync;
2. application error capture in `src/lib/error-capture.ts`, including the
   original error recovered when TanStack/h3 converts an SSR exception into a
   generic 500 response.

The server also has an optional dependency-free Sentry bridge. Set
`SENTRY_DSN` as a server secret to send SSR and middleware exceptions as Sentry
envelopes. When the variable is absent, the bridge is a no-op and local logs
remain unchanged. No DSN or secret is committed to the repository.

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