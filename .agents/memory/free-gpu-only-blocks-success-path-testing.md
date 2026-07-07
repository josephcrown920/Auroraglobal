---
name: Free-GPU-only flag blocks success-path e2e testing
description: Why a real credit-charging e2e test can prove charge/refund symmetry but not the success (no-refund) branch in this project.
---

The live `app_settings.free_gpu_only` flag (`src/lib/app-settings.server.ts`,
read by `isFreeGpuOnlyMode()`/`assertFreeModeServable()` in
`orchestrator.server.ts`) has been observed ON in this project's real Supabase
backend. When ON, every paid provider (Replicate, FAL, etc.) is filtered out
before dispatch, so `orchestrate()` always fails with "Free GPU only mode is
on" for any kind with no eligible self-hosted worker online — regardless of
which provider API keys are present in the sandbox.

**Why:** this makes a real e2e credit test reliably exercise the FAILURE +
refund path (useful for proving charge amount + charge<->refund symmetry with
real `deduct_credits`/`grant_credits` RPCs) but makes it impossible to
exercise the SUCCESS path (charge sticks, no refund fires) without either
deploying a self-hosted GPU worker or flipping the live safety flag — which
should not be done casually since it is a real production safety control, not
a test toggle.

**How to apply:** when asked to verify a credit-charging generation flow
end-to-end, don't assume a "successful render" test is reachable just because
provider keys exist — check `app_settings.free_gpu_only` first. If it's ON,
scope the e2e proof to charge-amount + failure-refund-symmetry (still real,
still valuable) and call out the untested success branch explicitly rather
than silently skipping or forcing the flag off.

**Update (2026-07-07):** the flag is toggleable and was observed OFF; with it
off, the success path (charge sticks, no refund) was fully verified via direct
`reserveOrchestrateRecord` invocation as the QA user (own-studio-folder signed
reference URL). So check the flag per-session — it is not permanently ON.
A rerunnable spend-guarded smoke script exists at
`scripts/e2e-feature-generations.ts` (requires `CONFIRM_SPEND=1`).
