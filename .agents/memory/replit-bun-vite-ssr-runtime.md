---
name: Lovable export vite dev under Replit sandbox (runtime + watcher)
description: Why `bunx vite dev` can't serve SSR for this TanStack Start export, and the two fixes needed to get a healthy dev server.
---

# Getting this Lovable/TanStack-Start export's `vite dev` healthy in the Replit sandbox

Two INDEPENDENT, PRE-EXISTING breakages block `vite dev` here. Both reproduce with the
pristine original config (no cartographer involved). Fix both or SSR never serves.

## 1. Bun can't run the SSR native stack → napi panic
Running `bunx vite dev` serves the dev server, but the FIRST SSR request panics:
`napi/src/threadsafe_function.rs:235 ... "expect Function, got: Object"` (a tailwind
oxide / native-addon threadsafe-function call Bun's napi shim mishandles).

**Fix:** run Vite under real Node, not Bun.
- There is NO `node` on PATH even in a login shell (the `python-wrapped` entry exists
  but there's no `nodejs-wrapped`). The `nodejs-24` module is declared in `.replit`
  but was never realised into the env; `installProgrammingLanguage` reports
  "already installed" yet provisions nothing.
- A real node DOES exist in the nix store. Resolve it dynamically (survives nix-hash
  changes) with the Replit helper: `available-pid2-node-paths` (outputs e.g.
  `/nix/store/...-nodejs-22.22.0/bin/node`).
- Workflow command that works:
  `"$(available-pid2-node-paths | head -1)" node_modules/vite/bin/vite.js dev --host 0.0.0.0 --port 8080`
- Keep the `test` workflow on `bun test` — Bun is fine for the test runner; only the
  vite/SSR native stack is the problem.
**Why:** confirmed by reproducing the panic under Bun and getting clean HTTP 200 SSR
under Node 22 with the exact same config.

## 2. chokidar EMFILE crash from watching the bun install cache
The bun install cache (~86k files) lives INSIDE the workspace at `.cache/`. Vite's
chokidar watcher recurses into it and exhausts file descriptors (EMFILE), crashing
startup. **Fix:** `vite.server.watch.ignored = ["**/.cache/**"]` in `vite.config.ts`.

## Verified-good end state
`vite dev` under Node: cartographer loads, SSR returns 200 with
`data-replit-metadata` injected, `[vite] connected` (HMR), no EMFILE, no panic.
`vite build` is unaffected (cartographer is `apply:"serve"`, so 0 build activity and
no metadata in `dist/`).
