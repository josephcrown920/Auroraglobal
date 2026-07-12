---
name: Test setup (Bun runner)
description: How automated tests run in this repo and why test files are excluded from the app tsconfig
---

Automated tests run via Bun's built-in runner: `bun test src/` (wired as the
`test` npm script). Test files live next to source as `*.test.ts` and import
from `bun:test`.

`*.test.ts` / `*.test.tsx` are EXCLUDED from `tsconfig.json` (`exclude` array).
**Why:** Bun compiles+runs the TS itself, so tsc doesn't need them; and tsc has
no `bun:test` type declarations (no `@types/bun` installed), so including them
would add spurious "Cannot find module 'bun:test'" errors to the app typecheck.
ESLint here is NOT type-aware (no `project` in eslint.config.js), so it still
lints test files fine — just run `prettier --write` on new test files since the
prettier rule is enforced as an error.

**How to apply:** add new tests as `src/**/*.test.ts`; don't expect tsc to
typecheck them. To test module-private helpers (e.g. orchestrator
`dispatchRunpod`/`extractWorkerUrl`), `export` them from the source module.
For poll-loop code that sleeps on real timers against a deadline, install a fake
clock that advances a virtual `Date.now()` by each `setTimeout` delay — keeps the
deadline math intact while running instantly.

To test `orchestrate()` (the provider/model fallback engine): `SUPABASE_URL` is
set in the sandbox, so a top-level import of orchestrator.server eagerly builds a
real Supabase client → real network on use. Stub deps with bun `mock.module(...)`
+ a top-level `await import("./orchestrator.server")` AFTER the mocks (static
imports hoist above mock.module, so they'd bind the real module). Mock
`@/integrations/supabase/client.server` (a chainable, awaitable query builder
whose terminal resolves `{data:[],...}` makes the GPU pool report "no workers"),
plus `./replicate.server`, `./sync.server`, `./hf.server`. Shape the priority
chain per test via `process.env` provider keys; reset the shared in-memory HEALTH
map between tests by calling exported `markSuccess(name)` for every provider name.
Note `gpuWorker.supports()` returns true for EVERY kind, so it's always in the
chain unless cooled down or the (stubbed) worker query is empty.

**Bun per-test timeout:** Bun's per-test timeout must be set as the **3rd arg**
to `it("name", fn, timeoutMs)` and `beforeAll(fn, timeoutMs)`. The `{ timeout }`
option on `describe()` does NOT propagate to contained `it()` calls — every
slow test needs its own explicit timeout or it times out at the default 5000 ms.
Long-running integration tests (e.g. real ffmpeg assembly) need 180_000+ ms.
