---
name: BFL identity-locked avatar stills
description: How to generate identity-consistent character stills via the Black Forest Labs FLUX.2 MCP, and the gotchas that block output.
---

# Generating identity-locked avatar stills (BFL FLUX.2 MCP)

To keep a recurring character (e.g. landing "Josh") visually consistent across many
generated stills, pass reference image IDs as `input_medias` so FLUX holds the face
and brand identity:

`mcpBlackForestLabs_generateImage({ requests: [{ prompt, width: 768, height: 1344, input_medias: [{ id: faceId }, { id: brandId }] }] })`

**Why:** without the face/brand refs, each generation drifts to a different person.
With both refs the identity holds across varied scenes/poses (verified: 10 stills,
identity consistent).

**How to apply / gotchas:**
- Keep prompts **fully clothed** with no exposed-skin language. Prompts implying bare
  skin return `MODERATED_OUTPUT` (silent rejection, no image).
- The free generation pool is small (~a handful of requests) — batch deliberately.
- Portrait 768×1344 works well for TikTok/Reels-style vertical tiles.

## Image-to-video (i2v) for the same character
- The only configured i2v provider is **Replicate** (`REPLICATE_API_KEY`). It can 402
  on insufficient credit; no FAL/RUNWAY/HF/SYNC keys are present by default.
- **Do not** fall back to text-to-video to animate a locked character — t2v cannot
  preserve the reference identity. Either fund Replicate i2v (bytedance/seedance-1-lite,
  image=dataURI input) or keep existing identity-correct clips.
