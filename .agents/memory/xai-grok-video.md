---
name: xAI Grok Imagine Video integration
description: How xAI grok-imagine-video-1.5 is wired into Aurora's UGC pipeline and orchestrator.
---

# xAI Grok Imagine Video

## The rule
xAI does NOT take user-provided audio — it generates speech from the prompt text. So it is only suited for UGC-style generation (you provide a reference image + script prompt → it returns a talking-head video with built-in lipsync), NOT for traditional lipsync (user brings their own audio clip).

**Why:** Traditional lipsync routes audio+video through fal/heygen/replicate. xAI replaces the whole image→video→lipsync triad in UGC with one call, but can't replace audio-driven lipsync.

## How to apply
- UGC fast path in `runUGCAd` (jobs.server.ts): if `XAI_API_KEY` is set AND `avatarImageUrl` is present, generate script then call xAI; skip stages 2-5. Falls back to full pipeline on any error (warn log, no throw).
- xAI adapter registered in `orchestrator.server.ts` as `xaiDirect` under name `"xai"`, first in the video PRIORITY list (after gpuWorker).
- FALLBACK_MODELS[video] includes `"xai/grok-imagine-video-1.5"` at position 0.
- Prompt builder: `buildXAIUGCPrompt()` in `ugc.server.ts` — walk-toward-cam + spoken script + product context.

## API contract (verified from docs)
- POST `https://api.x.ai/v1/videos/generations` — body: `{ model, prompt, duration, resolution, image: { url } }`
- Response: `{ id: "<request_id>", ... }`
- Poll GET `https://api.x.ai/v1/videos/<request_id>` every 5s; done when `video.url` appears; error when `error` object appears.
- Timeout ceiling: 15 min.
- `XAI_API_KEY` is already set as a Replit secret.
