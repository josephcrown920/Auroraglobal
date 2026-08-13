---
name: Video chain exhaustion contract
description: Stable no-video-provider error for unpinned video, ffmpeg-free explicit-only gating, and toast-classification ordering
---

# Video chain exhaustion (est. 2026-08)

**Rule:** When an unpinned, non-self-hosted `kind:"video"` request exhausts every candidate, `orchestrate()` throws the exported `NO_VIDEO_PROVIDER_MSG` ("No video provider available right now — try again or switch model.") with a suffix that preserves the original tokens: `— <reasons>` on the nothing-tried path (keeps "missing config/key" → jobs classify terminal → refund) or `(last: <raw provider error ≤300ch>)` on the tried-and-failed path (keeps 5xx/400 → transient/terminal parity). Pinned (`pinnedModelOnly`) and `selfHostedOnly` requests still throw raw errors — their surfaces have accurate model-specific/worker messaging.

**ffmpeg-free is explicit-pick only:** its `supports()` requires `model === "ffmpeg-free-video"` (the catalog id in orchestration.functions.ts). It is NOT in FALLBACK_MODELS.video and must never be reachable as an automatic fallback — before this gate it was a silent catch-all that "succeeded" with a Ken Burns pan over a Pollinations still whenever all hosted video providers failed.

**Toast classification:** `no_video_provider` in error-toasts.ts keys on lowercase substring "no video provider available" and MUST stay ordered before the no_workers / out_of_credit / rate_limited buckets — the suffix can embed "No GPU workers available", 429, or balance tokens, and those buckets' "wait and retry" advice is exactly wrong for an exhausted chain. Generic strings ("No provider available for <kind>", "All providers failed") stay in the provider bucket.

**Why:** a raw last-provider error (often a stray 429) rendered as "busy, wait a moment", so users retried a dead chain; worse, the ffmpeg-free catch-all made exhaustion look like success with a non-AI video.

**How to apply:** any new video adapter or exhaustion path must either be model-gated or keep this wrap intact; never strip the suffix (jobs.server classifyJobError + ops logs depend on it); if other kinds (motion/audio) get the same treatment, mirror the ordering rule in error-toasts.
