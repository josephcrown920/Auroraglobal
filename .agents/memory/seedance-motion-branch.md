---
name: Seedance motion branch
description: How kind-"motion" requests reach Seedance — pinned-only, subscriber-gated, seedance-narrow kind equivalence in the byteplus/replicate adapters.
---

# Seedance as a motion engine (added 2026-08-11)

Kind-`motion` requests can ride a Seedance **video** mapping (animate-still i2v) in the byteplus and replicate adapters, but ONLY when the request pins a seedance model key with `forSubscriber: true`.

**Rules:**
- No seedance key ever goes into `FALLBACK_MODELS.motion` (same Kling/Seedance guardrail as the video chain: paid subscription-only providers never auto-fire as fallbacks, including for smoke tests).
- The motion→video kind equivalence in the replicate adapter is **seedance-prefix narrow** on purpose. Widening it to every video mapping silently changes which adapter serves existing motion sentinels (e.g. `veo-2` is served by the gemini adapter today; a generic equivalence would let replicate hijack it).
- Route order for a pinned subscriber motion request: BytePlus direct (once Ark-activated) → Replicate `seedance-1-lite` (live) → normal motion sentinel chain (fal LTX etc.).
- Pricing is safe without per-model motion tiers: motion is flat-priced (base 300 Aura ≈ $1.41 pool), which covers full-list Seedance 2.0/Lite clip costs.

**How to apply:** when registering a new Seedance checkpoint (e.g. "2.0 mini" once model-watch sees it), it inherits this branch automatically via BYTEPLUS_MAP/REPLICATE_MAP — do not add it to the motion fallback chain, and keep any new kind-equivalence gates model-prefix narrow.

Note: video-driven motion **transfer** (driving video + reference image) remains self-hosted-only (MimicMotion); Seedance cannot consume a driving video — its branch covers animate-still/camera-move motion.
