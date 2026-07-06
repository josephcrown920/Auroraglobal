---
name: Pre-existing orchestrator GPU-preference test failures
description: 4 tests in orchestrator.gpu-preference.test.ts fail on a clean checkout, unrelated to worker registration work
---

`bun test src/lib/orchestrator.gpu-preference.test.ts` fails 4 of 6 tests even run in
isolation on an otherwise-unmodified checkout (confirmed 2026-07-06) — e.g. "falls back
AND circuit-breaks the GPU pool when a real dispatch error occurs" expects a request to
hit the GPU worker host first but the mock never records that call. This is not
test-order/mock.module leakage (fails alone too) and is unrelated to
`workers/register.ts` / `gpu-worker-health.ts` / Admin UI changes.

**Why this matters:** don't treat this suite's failures as something a worker
self-registration fix caused or must fix — it's a pre-existing gap in the
orchestrator's self-hosted-first dispatch path (or its test mock) that needs its own
investigation.
