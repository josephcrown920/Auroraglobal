---
name: Vite dep optimizer crawl deadlock
description: Dev-only infinite hangs on modules importing optimized deps; diagnosis + holdUntilCrawlEnd fix
---

Symptom: `vite dev` serves SSR HTML fine, but the browser spins forever on first load (site "loads for an hour", nothing interactive). Direct curl of specific client module URLs (`/src/lib/x.ts`) times out with 0% CPU — an await-hang, not a busy loop. Which modules hang looks content-dependent (here: serverFn modules with module-level zod consts) and non-deterministic across restarts.

Root cause: the dep optimizer never commits. With TanStack Start's server-fn transform in the graph, Vite's static-import crawl never settles, so with the default `optimizeDeps.holdUntilCrawlEnd: true` the optimizer bundles into `node_modules/.vite/deps_temp_*` but never renames one to `deps/`. Every request whose client output retains an import of an optimized dep (react, zod, ...) awaits that commit forever. Modules whose client output strips all such imports (pure RPC stubs) return instantly — which is why it masquerades as a source-pattern bug (zod const retained ⇒ hang; stripped ⇒ fine).

Diagnostic fingerprint (check in this order, saves hours):
- `ls node_modules/.vite/` → multiple `deps_temp_*` dirs and NO `deps/` dir = optimizer wedged. One temp dir per restart.
- `curl -m 10 localhost:8080/node_modules/.vite/deps/zod.js` (or react) hangs = confirmed.
- Version bisecting / downgrading packages is a red herring — the hang is version-independent.

Fix: set `optimizeDeps: { holdUntilCrawlEnd: false }` in vite config (commits the first optimizer run immediately) and `rm -rf node_modules/.vite` once to clear the wedge. Verified: `deps/` appears within seconds of restart and all module transforms return in <0.1s.

**Why:** cost us a full day of probe-file bisecting under a wrong "zod const in serverFn module deadlocks the transform" theory.
**How to apply:** any time dev-mode module requests hang forever while SSR works, check `.vite/` cache state FIRST before blaming source patterns or package versions.
