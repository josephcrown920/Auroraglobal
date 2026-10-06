---
name: xAI Grok Imagine Video integration
description: How xAI grok-imagine-video-1.5 is wired into Aurora's UGC pipeline and orchestrator.
---

# xAI Grok Imagine Video

## The rule
xAI does NOT take user-provided audio — it generates speech from the prompt text. Since the voice-lock upgrade, whenever ANY voice track exists (user-supplied audio wins over TTS), the xAI clip MUST be re-lip-synced to that track via the unpinned lipsync fallback chain before shipping. The raw xAI built-in voice ships only when no voice track exists at all (surfaced in meta).

**Why:** The character's voice must stay identical across renders — xAI invents a new voice every call, so shipping it over an available voice track breaks voice consistency (explicit user requirement). Only the xAI VIDEO stage is model-pinned; the relip stage keeps the whole lipsync provider chain open.

## How to apply
- UGC fast path in `runUGCAd` (jobs.server.ts): voice stage (user audio > TTS) runs BEFORE the fast path; if `XAI_API_KEY` + `avatarImageUrl`, xAI generates the clip, then relips it to the voice track. Relip failure falls through to the multi-stage pipeline; there, a USER-audio relip failure fails the job (refund), a TTS relip failure degrades explicitly.
- Same contract in the /lipsync "xai-ugc" engine (lipsync.server.ts): two mandatory stages, either failing = fail + refund; priced as video(standard)+lipsync(premium) via `lipsyncEngineCost`.
- xAI adapter registered in `orchestrator.server.ts` as `xaiDirect` under name `"xai"`, first in the video PRIORITY list (after gpuWorker).
- FALLBACK_MODELS[video] includes `"xai/grok-imagine-video-1.5"` at position 0.
- Prompt builder: `buildXAIUGCPrompt()` in `ugc.server.ts` — walk-toward-cam + spoken script + product context.

## API contract (verified from docs)
- POST `https://api.x.ai/v1/videos/generations` — body: `{ model, prompt, duration, resolution, image: { url } }`
- Response: `{ id: "<request_id>", ... }`
- Poll GET `https://api.x.ai/v1/videos/<request_id>` every 5s; done when `video.url` appears; error when `error` object appears.
- Timeout ceiling: 15 min.
- `XAI_API_KEY` is already set as a Replit secret.
- **403 signature:** `permission-denied` / "used all available credits or reached its monthly spending limit" = xAI account-level exhaustion, NOT a code/routing bug. When every video provider is account-blocked at once, the chain still walks all candidates and wraps the last failure in the stable "No video provider available right now" message — that wrap means exhausted providers, not a dispatch regression.
