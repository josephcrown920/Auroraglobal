---
name: Provider exhaustion July 2026
description: Status of all video/lipsync providers as of July 23 2026; all exhausted except replit-gemini-image for still images.
---

As of 2026-07-23, confirmed via live provider_logs:

**Video generation — ALL failing:**
- BytePlus: `ModelNotOpen` for `seedance-1-0-pro-fast-251015` AND `seedance-1-0-pro-250528` (account 3003324153 has ZERO activated video models since at least 2026-07-05)
- xAI: `403 permission-denied` — credits exhausted
- Gemini Veo (`veo-3.1-fast-generate-preview`): `400 durationSeconds out of bound` even when sending valid values; likely the key has no video quota or the model doesn't support I2V
- Replicate: `402 insufficient credit`
- Fal: `403 exhausted balance`
- HeyGen video: `unknown` (voice_id fix worked but API credits gone)

**Lipsync — ALL failing:**
- sync.so: `402 free_tier_generations_exhausted` — 3/3 free generations used this month
- HeyGen `/v3/lipsyncs`: `"Insufficient credit. This operation requires 'api' credits"` — 'api' credit pool depleted (separate from remaining_quota)
- Replicate: `402 insufficient credit`
- Fal: `403 exhausted balance`

**Still working:**
- `replit-gemini-image:gemini-2.5-flash-image` — Replit's Gemini proxy for image generation

**Why:** All API keys and free-tier quotas are depleted; operational issue, not code bugs.

**How to apply:** When debugging provider failures, check this against current provider_logs before spending time on code changes. When providers are refunded, the smoke fallbacks auto-bypass.
