---
name: HeyGen "api" credit pool is separate from remaining_quota
description: Why HeyGen photo/video-agent calls can fail with insufficient-credit errors even when the account looks fine.
---

HeyGen's `POST /v3/videos` (photo→talking-head) and `/v3/video-agents` calls can fail with
`failure_code: MOVIO_PAYMENT_INSUFFICIENT_CREDIT` ("Insufficient credit. This operation
requires 'api' credits.") even when `GET /v2/user/remaining_quota` reports a healthy non-zero
`remaining_quota`/`api` number.

**Why:** `remaining_quota` reflects a different balance (looked like streaming/interactive-avatar
minutes) than the pay-as-you-go "api" credit pool that photo-animation and video-agent renders
draw from. A batch of jobs can burn through the small "api" pool fast — one job in a batch of 4
succeeded, the other 3 (submitted concurrently AND retried sequentially afterward) all failed
identically, ruling out a concurrency/rate-limit cause and confirming true credit exhaustion.

**How to apply:** When a HeyGen photo/video-agent call fails with this exact error, don't assume
it's a bug or a transient rate limit — check with the user whether they need to top up HeyGen "API"
credits specifically (separate from any interactive-avatar credit balance) before retrying. Don't
burn further calls testing the same failure once one job in a batch already reproduces it.
