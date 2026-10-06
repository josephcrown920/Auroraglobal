---
name: Stale Vite optimized deps block hydration (looks like a form bug)
description: Why /auth (or any route) can render SSR HTML but never hydrate in the dev server, and how to tell it from an app regression.
---

**Rule:** If a headless-browser check against the dev server shows SSR HTML but the page never hydrates (e.g. `data-hydrated` stays `"false"`, submit button stuck on "Loading…"), check the browser network log for `504 (Outdated Optimize Dep)` on a `/node_modules/.vite/deps/*` chunk BEFORE debugging the component. Restart the `Start application` workflow; the fresh optimizer run fixes it.

**Why:** 2026-09-12 — two sessions in a row wasted time on the auth form's hydration marker "staying false". The real cause was a stale Vite dep cache after a dependency/route change: the TanStack Start client entry dynamically imports an optimized dep whose hash changed, Vite answers 504, the client entry throws `Failed to fetch dynamically imported module`, and React never hydrates. The form then looks like it silently ignores submits — indistinguishable from a real bug from the user's side (which is why the auth form now disables submit with "Loading…" until hydrated).

**How to apply:** Any Playwright/curl-based verification of client behaviour in dev: assert hydration first, and on failure grep the console for `Outdated Optimize Dep` / `Failed to fetch dynamically imported module`, then restart the workflow and retry once before touching code. Related: vite-dep-optimizer-crawl-deadlock.md (a different optimizer failure — deps never committed at all).
