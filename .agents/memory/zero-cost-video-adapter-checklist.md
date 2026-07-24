---
name: Adding a $0 external video adapter
description: The five registration touch points a new zero-cost external video adapter must hit, including both free-mode exclusion checks.
---

**Rule:** A new external video adapter (especially a $0/free one) is not fully wired until all five touch points are updated. Missing one causes silent misrouting or the adapter never being selected.

**Why:** The orchestrator's candidate selection, tiering, and free-mode gating are spread across several independent structures that are not derived from each other; partial registration compiles fine but misbehaves at runtime.

**How to apply:** When adding a video adapter, update all of:
1. The provider PRIORITY list (selection order).
2. `FALLBACK_MODELS` for the video kind (or the adapter is unreachable without a pinned model).
3. `MODEL_REGISTRY` (model metadata/slug mapping).
4. `VIDEO_MODEL_TIERS` (pricing tier — a $0 adapter still needs an entry).
5. Free-mode gating — BOTH checks: `isFreeAdapter` inclusion/exclusion AND the `assertFreeModeServable` inline check. These are two separate code paths; a free adapter must pass both, a paid one must be rejected by both.
