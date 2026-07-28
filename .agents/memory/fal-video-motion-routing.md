---
name: fal.ai first-priority video/motion routing
description: How fal.ai is wired as the first-priority cloud backend for video and motion, with model-key gating to prevent hijacking pinned requests.
---

## Rule
`falFallback` is at PRIORITY slot 1 (after gpuWorker) for both `video` and `motion`. It is model-key gated in `supports()` so it only fires for:
- `video`: unkeyed requests OR model starts with `fal/` OR model is in FAL_MAP
- `motion`: ONLY explicit `fal/` sentinel keys (no keyless motion — would throw "no path for kind motion")
- `image`: fully permissive (unchanged behavior, identity-edit routing)
- `lipsync`: requires both `videoUrl` and `audioUrl` present

**Why:** Without the gate, a position-1 `falFallback` would intercept every pinned video request (kling/xai/gemini/replicate) since `supports()` previously returned `true` for any request when FAL_KEY is set.

## Sentinel model keys (FALLBACK_MODELS[0])
- `video` → `"fal/ltx-video"` → FAL_MAP path: `fal-ai/ltx-video` (~$0.06, budget tier)
- `motion` → `"fal/ltx-motion"` → FAL_MAP path: `fal-ai/ltx-video/image-to-video` (~$0.06, budget tier)

Both are in `VIDEO_MODEL_TIERS` (pricing.ts) and `MODEL_REGISTRY` (orchestrator.server.ts).

## FALLBACK_CAP
- `video`: 5 (bumped from 4 when fal/ltx-video added as first entry)
- `motion`: 2 (bumped from 1 when fal/ltx-motion added as first entry)

## FAL_KEY balance risk
FAL_KEY can deplete silently — fal.ai returns HTTP 403 with `{"detail":"User is locked. Reason: Exhausted balance..."}`. Check dashboard at fal.ai/dashboard/billing before relying on it as first-priority.

**How to apply:** Any new fal video/motion sentinel added to FALLBACK_MODELS must also go into FAL_MAP (path), VIDEO_MODEL_TIERS (pricing.ts), and MODEL_REGISTRY (orchestrator.server.ts). Missing any one of these causes a pricing test failure or a "no path for kind" throw.
