# Video Agent Iteration Audit — 2026-09-02

## Purpose
A second-pass audit after the shared memory, production, ModelArk and streaming upgrades. This document deliberately records gaps instead of treating the presence of a file/UI as proof of completion.

## Fixed in this iteration
- ModelArk is now first in the shared production provider preference for video/image work, with FAL → Replicate → Vast/ComfyUI fallbacks.
- Aurora Global's LLM router now has a first-class ModelArk provider and creative categories prefer it when `ARK_API_KEY`/`BYTEPLUS_API_KEY` is configured.
- Aurora Global keeps a server-only ModelArk SSE endpoint with usage events and `service_tier:auto` support.
- Video-agent runtime now combines project memory, skills, presets and ModelArk generation without bypassing the existing orchestration layer.
- The supplied Aurora preset aliases and viral preset index are available to the core and exported video agent.
- Supplied HeyGen/Chengfeng/Xiaohei/self-evolution skill distinctions are preserved rather than flattened into one generic skill.
- Standalone video agents received the same production preference, preset index, skill router and runtime seam.

## Existing architecture verified
- Video script generation already enters the normal Aurora `routedGenerate` path, so the updated `SCRIPT_WRITING` chain can use ModelArk before fallbacks.
- Existing video generation remains behind the Aurora orchestration/queue architecture rather than being replaced with a direct client call.
- The exported Aurora Video Agent has its own API and memory/production surfaces.

## Gaps deliberately left visible
1. **Legacy keyframe route:** `/api/video-agent/generate-frame` still uses Pollinations. It is intentionally not silently switched to paid ModelArk because the route currently has no demonstrated authenticated paid-generation boundary. Switching it requires an auth/credit guard first.
2. **UI streaming consumer:** the stable `/api/video-agent/stream` SSE endpoint exists, but the main Video Agent composer/process UI does not yet have verified end-to-end consumption of that endpoint. The backend is ready; the final UI binding is a separate change.
3. **Live provider verification:** GitHub cannot prove that the user's current ModelArk key has access to a particular Seedance/Seedream model. Model IDs therefore remain environment-configurable rather than hard-coded to an unverified slug.
4. **Visual QA:** candidate scoring and acceptance contracts exist, but real frame-level vision comparison still requires a live vision provider/worker and stored artifacts.
5. **Durable eventing:** the architecture has job/event surfaces, but production Redis/Postgres/worker provisioning still determines durability and scale.
6. **External skills:** uploaded skill documents are represented as routing contracts; their proprietary runtime executors are not copied blindly into every product.

## ModelArk operating policy
ModelArk is a preferred backend because the owner has substantial quota, not because it should become a single point of failure. The router may still choose FAL, Replicate, HeyGen or Vast/ComfyUI when they are a better fit, unavailable, cheaper, identity-sensitive, or explicitly requested.

## Current activation variables
```text
ARK_API_KEY=...
ARK_BASE_URL=https://ark.ap-southeast.bytepluses.com/api/v3
MODELARK_TEXT_MODEL=<active text/reasoning model or endpoint>
MODELARK_IMAGE_MODEL=<active Seedream model or endpoint>
MODELARK_VIDEO_MODEL=<active Seedance model or endpoint>
MODELARK_SERVICE_TIER=auto
```

Never commit these values.

## Acceptance rule
A video-agent capability is not considered complete merely because a UI control, adapter, or route exists. The full path must be observable:

`UI → authenticated API → agent plan/memory → provider router → provider job → progress/events → QA → targeted revision → render → verified artifact`

Any stage that cannot be demonstrated remains an open item rather than being marked production-complete.
