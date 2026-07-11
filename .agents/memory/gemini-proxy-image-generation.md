---
name: Gemini AI-integrations proxy image generation
description: Working request shape for image generation/editing via the Replit Gemini AI-integrations proxy when direct provider keys fail.
---

The Replit-managed Gemini proxy can generate/edit images when fal, Replicate, BytePlus, and the user's own Gemini key all fail (quota/moderation/dead slugs).

**Working recipe:** `POST {AI_INTEGRATIONS_GEMINI_BASE_URL}/models/gemini-2.5-flash-image:generateContent`
- Do NOT prepend `/v1beta` — the base URL already routes correctly; adding it 404s.
- Body: `contents: [{ role: "user", parts: [...] }]` — role must be present.
- Reference images go as `inline_data: { mime_type, data(base64) }` parts alongside the text prompt (supports identity-locked edits).
- `generationConfig.responseModalities: ["TEXT", "IMAGE"]` is required or the model returns text only.
- Response images arrive as `inlineData.data` base64 in candidate parts.

**Why:** discovered while generating identity-locked landing photos; every other provider path failed but this worked first try.
**How to apply:** treat as the reliable fallback for one-off asset generation from inside the workspace; not wired into the app's orchestrator.
