---
name: TanStack router-core nested copy conflict
description: npm override pattern to fix getScriptPreloadAttrs build failure when nested router-core version mismatches root
---

# TanStack router-core nested copy conflict

**Observed July 2026:** prod-build fails with "getScriptPreloadAttrs is not exported by @tanstack/router-core". Root: react-start-server@1.167.22 and start-server-core carried nested router-core@1.171.15 (has the export), but root was 1.168.17 (missing it). Rollup resolves to root at bundle time → crash.

**Fix:** add `"overrides": { "@tanstack/router-core": "1.171.15" }` to root package.json, run `npm install --legacy-peer-deps`. The override hoists router-core to root; npm deduplicates the nested copies.

**Why:** Rollup resolves bare specifiers to the root node_modules at bundle time, not to the nested copy that originally imported it. So the SSR bundle built from react-start-server's code fails when the root doesn't match.

**Critical gotcha:** NEVER delete ALL nested node_modules dirs under @tanstack packages. start-plugin-core needs its own nested Zod with a custom `.prefault()` method — removing it breaks the dev server with "prefault is not a function". Only target the specific conflicting nested router-core.

**How to apply:** After any TanStack bump, verify: `grep -c getScriptPreloadAttrs node_modules/@tanstack/router-core/dist/esm/index.js`. If 0, bump the override version.
