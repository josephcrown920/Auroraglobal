---
name: Kling and Seedance subscription gate
description: Why Kling and Seedance video are subscriber-gated and the three-layer enforcement pattern.
---

**Rule:** Kling and Seedance video generation must only be reachable for subscriber requests (`forSubscriber: true` on the generate request) and must never appear in the general fallback chain.

**Why:** Kling was once reachable as an ordinary fallback model and burned ~$7.56 of real provider spend on test/free traffic. Seedance was later added to `FALLBACK_MODELS.video` without a subscriber gate, exposing the same billing hole via both BytePlus (direct) and Replicate (fallback). Both providers are paid, per-second-billed with no free tier.

**Three-layer enforcement (both providers must follow all three):**
1. **Absent from `FALLBACK_MODELS.video`** — free-tier video requests that exhaust earlier models must never land on a paid provider.
2. **`forSubscriber: true` in the adapter's `supports()`** — gates explicit model requests at the adapter level. BytePlus gates on `r.kind === "video"` (Seedream image is unaffected). Replicate gates on `r.model.startsWith("seedance")`.
3. **`forSubscriber: true` on all explicit `orch()` calls** that use these models in jobs/pipelines (TikTok remix, UGC Spin, kids story, etc.) — if the job is subscriber-only downstream, the orchestrate call must carry the flag or it silently falls through a non-gated path.

**Free mode has TWO additional exclusion paths** that both must reject paid adapters: the `isFreeAdapter` filter AND the inline `assertFreeModeServable` check. Excluding a paid provider from only one still lets it serve in the other.

**Adding a new paid-only video provider:** Remove from `FALLBACK_MODELS.video`, add `forSubscriber !== true` guard to adapter `supports()`, add `forSubscriber: true` to all explicit `orch()` calls.
