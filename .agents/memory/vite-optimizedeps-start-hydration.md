---
name: vite optimizeDeps.include vs TanStack Start
description: Why adding "@tanstack/react-start" to optimizeDeps.include kills client hydration app-wide, and how to diagnose it
---

# Never put "@tanstack/react-start" in optimizeDeps.include

**Rule:** user-supplied `optimizeDeps.include` entries WIN over the TanStack Start plugin's own `optimizeDeps.exclude`. Including `@tanstack/react-start` makes Vite pre-bundle the raw package for the browser; its start-storage-context runs top-level `new AsyncLocalStorage()` (node:async_hooks), which throws under Vite's browser stub and kills client-side React entirely.

**Symptoms (app-wide, not per-component):** every interactive element is dead — sign-in form falls back to native GET submit (lands on `/auth?`), Menu/sidebar buttons unresponsive, no React DevTools message in browser console, `async_hooks` / AsyncLocalStorage error in console.

**Why:** pre-bundling bypasses the Start plugin's server-code-stripping transform, so server-only code reaches the browser bundle.

**How to apply:** keep `@tanstack/react-start` out of `optimizeDeps.include` in vite.config.ts. After removing, `rm -rf node_modules/.vite` and restart dev, then confirm with `grep -c "@tanstack/react-start" node_modules/.vite/deps/_metadata.json` → 0. optimizeDeps is dev-only, so prod builds never showed the bug.
