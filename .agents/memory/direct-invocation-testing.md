---
name: Direct-invocation testing for server-side generation flows
description: How to verify credit-charging generation flows end-to-end when the Playwright/runTest browser layer is flaky or the wire format is hard to replicate over raw HTTP.
---

When a feature must be verified as a real, logged-in, credit-charging call
through the actual production code path (not a unit test with mocked deps),
but the browser-based `runTest` layer is unavailable or flaky, bypass the
browser and HTTP layers entirely and call the underlying `.server.ts`
function directly from a `bun run some-script.ts` script in the real project
shell (real env vars, real Supabase/provider credentials). Import the same
exported function the server-fn handler calls (e.g.
`reserveOrchestrateRecord` from `generate-core.server.ts`) rather than the
`createServerFn`-wrapped export — the wrapper is just RPC plumbing, the
exported core function IS the production logic (credit reserve → real
provider call → DB writes → commit/release). This is strictly narrower than
mocking: every downstream effect (credits, provider call, `provider_logs`,
`generations` rows) is real; only the browser click and the RPC transport
are skipped.

**Why:** `runTest`'s browser layer intermittently fails with infra-level
errors unrelated to the app itself (see the runTest reliability note in
MEMORY.md); server function wire formats (TanStack Start server-fn RPC, etc.)
are non-trivial to hand-replicate via raw `curl`/`fetch`, making that a poor
fallback. Calling the real exported server function directly sidesteps both
problems while still exercising 100% of the real logic.

**How to apply:** identify the core exported function beneath the
`createServerFn(...).handler(...)` wrapper, write a small script that
imports it via the project's path aliases (bun resolves `tsconfig.json`
`paths` natively, no build step needed), supply a real user id and real
inputs, and run it with `bun run path/to/script.ts` from the project shell
(never from the `code_execution` sandbox — it lacks real project secrets).
