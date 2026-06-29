---
name: Orchestrator text modality + vision
description: How/whether image analysis works through the orchestrate() text path, and the pollinations-first gotcha.
---

The orchestrator `text` modality supports image input (vision) via `imageUrls`:
openAIChat + makeTextAdapter forward `imageUrls` as an OpenAI-style multimodal
content array; geminiText inlines trusted refs as `inline_data`. Text-only callers
(no imageUrls) keep the plain-string content — no behavior change.

**Gotcha — pollinations is first.** PRIORITY.text and FALLBACK_MODELS.text both
lead with free pollinations, which CANNOT see images (GET URL API). So a generic
`orchestrate({kind:"text", imageUrls})` will usually hit pollinations and return a
description NOT based on the image — unless you pin a vision-capable keyed model
that's reachable. Pinning `req.model` helps because getCandidateModels prepends it,
so it's tried FIRST; e.g. `model:"lovable/gemini-2.5-flash"` gives real vision when
LOVABLE_API_KEY exists, else falls through to blind pollinations.

**Why:** the image models (gemini-3.1-flash-image / nano-banana) already preserve
identity from a reference image far more reliably than any text description. So treat
any text vision pass as best-effort enrichment ONLY: always pass the reference image
to the image gen and make it the authoritative source of truth, and frame the
description as secondary ("ignore if it conflicts with the image"). A blind/hallucinated
description then can't override identity.

**How to apply:** identity-preserving image tools (colors, split-reality, reshoot)
should pass the reference image to every image gen and keep prompts authoritative on
the image. A separate text analysis call is optional polish, not the mechanism.
