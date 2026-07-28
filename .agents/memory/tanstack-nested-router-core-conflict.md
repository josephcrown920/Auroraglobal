---
name: TanStack router-core nested copy conflict
description: npm override pattern to fix getScriptPreloadAttrs build failure when nested router-core version mismatches root; version alignment rule to prevent handleHashScroll crash
---

# TanStack router-core nested copy conflict

## The override (why it exists)

`react-start-server` carries a nested `router-core@1.171.15` (the version that exported `getScriptPreloadAttrs`). The root `router-core` was older and missing that export. Rollup resolves bare specifiers to root at bundle time → crash.

**Fix:** add `"overrides": { "@tanstack/router-core": "1.171.15" }` to root package.json, run `npm install --legacy-peer-deps`.

## The misalignment trap (July 2026)

After the override was added, `@tanstack/react-router` drifted behind at 1.168.25. That version imports `handleHashScroll` from `router-core`, but `router-core` 1.171.15 does NOT export it — crash in both dev server (SSR) and prod-build (Rollup).

**Fix:** upgrade `@tanstack/react-router` to its latest (1.170.18+) which no longer imports `handleHashScroll`. Also bump `@tanstack/router-plugin` to its latest (1.168.23+).

## Invariant to maintain

`@tanstack/react-router` and `@tanstack/router-core` override must be kept in lock-step. After any TanStack bump, verify:
1. `grep -c getScriptPreloadAttrs node_modules/@tanstack/router-core/dist/esm/index.js` → must be > 0
2. `grep -c handleHashScroll node_modules/@tanstack/react-router/dist/esm/Transitioner.js` → must be 0 (if > 0, react-router is behind core again)
3. Run prod-build before marking a TanStack version bump complete.

## Current pinned versions (July 2026)

- override `@tanstack/router-core`: `1.171.15`
- `@tanstack/react-router`: `^1.170.18` (installed 1.170.18)
- `@tanstack/react-start`: `^1.168.28` (installed 1.168.32, latest)
- `@tanstack/router-plugin`: `^1.168.23` (installed 1.168.23, latest)

**Why:** Rollup resolves bare specifiers to root node_modules at bundle time, not the nested copy. So the root must match whatever the SSR bundle needs, and react-router must be >= the version that stopped importing removed exports.

**Critical gotcha:** NEVER delete ALL nested node_modules dirs under @tanstack packages. start-plugin-core needs its own nested Zod with a custom `.prefault()` method — removing it breaks the dev server with "prefault is not a function". Only target the specific conflicting nested router-core.
