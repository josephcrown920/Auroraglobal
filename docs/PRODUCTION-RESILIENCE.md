# Aurora Production Resilience Layer

Aurora uses a defense-in-depth deployment model. A release is not considered a rollback target merely because it exists in Git; it becomes the rollback target only after the Aurora quality gate succeeds on `Main`.

## Layers

1. **Quality gate** — lint, typecheck, isolated tests, migration checks, worker-entry audit, build, and the resilience contract.
2. **Runtime containment** — React error boundaries and router fallbacks prevent a single component/route failure from taking down the entire UI.
3. **Asset/navigation recovery** — the service worker handles cached assets and navigation fallback behavior.
4. **Known-good certification** — a successful `Aurora quality gate` promotes the tested SHA to:
   - `production-certified-<12-char-sha>` (immutable audit marker)
   - `production-known-good` (moving rollback pointer)
5. **Production watchdog** — an optional health probe can detect repeated production failures.
6. **Provider rollback bridge** — an optional `AURORA_ROLLBACK_WEBHOOK_URL` can receive a request to redeploy the `production-known-good` target.

## Required deployment binding

GitHub cannot safely guess which production provider owns Aurora. The repository therefore stops short of silently changing production infrastructure. To enable infrastructure-level automatic rollback, configure:

- `AURORA_HEALTHCHECK_URL` — a production health endpoint that returns HTTP 2xx only when Aurora is healthy.
- `AURORA_ROLLBACK_WEBHOOK_URL` — a trusted deployment bridge that receives the certified rollback request and redeploys the `production-known-good` SHA.

The bridge must authenticate the request, deploy only the supplied certified SHA/tag, wait for health checks, and fail closed if the target cannot be deployed.

## Important invariant

`Main` is not itself the rollback target. The rollback target is the latest commit that passed the complete Aurora quality gate and was promoted by `known-good.yml`.

This prevents a broken commit from becoming the thing Aurora falls back to.

## User-facing failure policy

The resilience layer should prefer, in order:

**recover → retry → fallback/degrade → isolate the failing feature → report telemetry → rollback deployment**

A white screen should be treated as a containment failure and therefore as a release/observability defect, not normal application behavior.
