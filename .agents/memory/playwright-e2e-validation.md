---
name: Playwright e2e validation quirks
description: Environment-specific rules for keeping the Playwright e2e validation gate reliable in this workspace
---

# Playwright e2e validation quirks

- **Reduced-motion emulation must be per-page.** The context-level `reducedMotion` option is silently ignored by the Chrome-for-Testing build here — `matchMedia` still reports no-preference. Use `page.emulateMedia({ reducedMotion: "reduce" })`.
  **Why:** verified with a minimal matchMedia probe; the context option never propagated.
  **How to apply:** any test asserting prefers-reduced-motion behavior calls emulateMedia before navigation.

- **Never manually create/close a browser context inside a test** when `trace: "retain-on-failure"` is on — teardown produces corrupt/truncated trace zips that fail the test. Use built-in fixtures.

- **Playwright's webServer command runs under `/bin/sh`.** Anything needing bash features (e.g. the node-path resolver script, which uses `set -o pipefail`) must be wrapped in `bash -c '...'`.

- **ESLint must ignore Playwright output dirs** (`test-results`, `playwright-report`): lint and the e2e suite run as parallel validations, and Playwright deleting those dirs mid-scan crashes ESLint's file walk with ENOENT (exit 2).

- **`playwright install --with-deps` fails here** (needs root); plain `playwright install chromium` works and is a fast no-op when cached.

- **The validation runner's poll budget can expire on a cold e2e run** (browser download + dev-server boot + sequential suite). POLL_BUDGET_EXCEEDED / ERROR from the run is an infra timeout, not a test failure — run the registered command directly in the shell to get the true result.

- **Suite reliability rules:** keep `retries: 1` (absorbs transient dev-server/auth blips without masking persistent regressions), cap the webServer heap with NODE_OPTIONS (a mid-suite OOM kill shows up as ERR_CONNECTION_REFUSED in every remaining test), and make auth-dependent beforeEach hooks re-sign-in once if the page lands signed out.
