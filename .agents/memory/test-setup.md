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
