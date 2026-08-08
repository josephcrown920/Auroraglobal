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

## Seedance 2.5 on fal (added 2026-08-08)
- fal hosts `bytedance/seedance-2.5/{image-to-video,text-to-video,reference-to-video}` — ~$0.473/s at 720p (≈$2.37 per 5s clip), ~$0.2205/s at 480p.
- **Duration trap:** fal's `duration` input is a STRING enum "4".."30" defaulting to `"auto"`, which lets the model run to its native 30s ≈ $14/clip. Every dispatch MUST send an explicit clamped duration string.
- Seedance is subscription-only on EVERY adapter — replicate, byteplus, AND falFallback all gate `model.startsWith("seedance") && forSubscriber !== true` in supports(). Adding a new seedance route means adding the gate there too.
- FAL_MAP entries now support optional `textPath` (prompt-only requests) and `build(r)` (custom input body, mirrors REPLICATE_MAP).
- Fal cost drives pricing: seedance-2.5 needed a new "max" ModelTier (600 Aura video) because ultra's pool ($2.26) < 2.37×1.15 margin-guard requirement.
