---
name: Playwright Chromium shm crash in long single-tab suites
description: Why long multi-route Playwright passes died with "Page crashed"/ERR_INSUFFICIENT_RESOURCES in this container and the two-part fix (keep shm on /dev/shm, fresh tab per visit).
---

**Symptom:** a Playwright test that navigates one tab through dozens of app routes dies a couple of dozen visits in — `page.goto: Page crashed` (renderer SIGBUS), later `net::ERR_INSUFFICIENT_RESOURCES`, "Failed to fetch dynamically imported module", or an anonymous page stuck on its spinner for 30 s+. Short suites never show it, so it looks like a flaky test or an app regression.

**Root cause (verified 2026-09-04):** Chromium's renderer accumulates *thousands* of shared-memory regions across back-to-back navigations in the same tab (fd count 10 → 1700 in ~6 visits, purged only under memory pressure). Playwright launches Chromium with `--disable-dev-shm-usage`, which puts those regions in `/tmp` — here a quota'd btrfs volume whose accounting lags the create/unlink churn → `shm_open: Disk quota exceeded` → SIGBUS. `/dev/shm` is a 3.9 GB tmpfs, so the default is counter-productive in this container. The renderer is also under genuine memory pressure at that point, which is the ERR_INSUFFICIENT_RESOURCES / hang flavour.

**Fix (both parts matter):**
1. `playwright.config.ts` — `use.launchOptions.ignoreDefaultArgs: ["--disable-dev-shm-usage"]`, gated on `fs.statfsSync("/dev/shm")` ≥ 1 GB so tiny-/dev/shm containers keep the default.
2. Route-crawling suites open a **fresh tab per visit and close it** (`context.newPage()` … `page.close()`), sharing the context so the localStorage session survives. Closing the tab retires its renderer for good; a single long-lived tab never recovers.

**How to apply:** any new suite that visits many routes in a loop must use the per-visit tab pattern (see `e2e/all-routes.e2e.ts` `runPass`). Don't "fix" this class of failure by shrinking the route list or adding retries.

**Also:** running Playwright + the dev server + heavy shell polling together pushed the 4-vCPU container to load ~20 and the tool server dropped ("SERVER unexpectedly disconnected", workflows killed, dev server gone). Run long suites `nice`d, in the background, and don't poll `/proc` in tight loops alongside them; restart "Start application" afterwards if `curl localhost:8080` returns 000.
