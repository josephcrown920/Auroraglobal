---
name: Signed-in visual checks
description: How to screenshot authed-only pages without passwords or the flaky runTest browser layer
---

The Screenshot tool always shows the logged-out gate for auth-guarded routes. For signed-in visual verification, run a small local Playwright script that:

1. Gets a real session via `scripts/lib/get-test-session.ts` (magic-link `generateLink` → `verifyOtp` exchange for the QA user; no password anywhere).
2. Injects the FULL session JSON into localStorage under `sb-<project-ref>-auth-token` via `addInitScript` before navigation.
3. Navigates to `http://localhost:8080/<route>`, waits ~6s for auth + queries, dismisses first-run onboarding ("Skip for now") if present, screenshots to /tmp.

**Why:** runTest's browser layer stalls some sessions (see runtest-max-iterations-stall), and the Screenshot tool can't authenticate. This gives deterministic signed-in captures.

**How to apply:** reuse/adapt `scripts/screenshot-studio-signed-in.ts`. Chromium may need `npx playwright install chromium` first (downloads to `.cache/ms-playwright`). Run with `bun run`.
