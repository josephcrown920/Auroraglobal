---
name: Kling subscription gate
description: Why Kling video is subscriber-gated and how free-mode exclusion has two separate code paths.
---

**Rule:** Kling video generation must only be reachable for subscriber requests (`forSubscriber: true` on the generate request) and must never appear in the general fallback chain.

**Why:** Kling was once reachable as an ordinary fallback model and burned ~$7.56 of real provider spend on test/free traffic before anyone noticed. It is a paid, per-second-billed provider with no free tier.

**How to apply:** When touching video routing or fallback lists:
- Keep Kling out of `FALLBACK_MODELS` for video — it is selected only when a request explicitly carries the subscriber flag.
- Free mode has TWO separate exclusion paths that both must reject paid adapters: the `isFreeAdapter` filter AND the inline `assertFreeModeServable` check. Excluding a paid provider from only one of them still lets it serve (and bill) in the other path.
- Any new paid-only provider should follow the same pattern: explicit opt-in flag, absent from fallback chains, excluded in both free-mode checks.
