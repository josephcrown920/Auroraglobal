---
name: Gemini image provider routing & funding
description: Which providers can actually serve Gemini-family image models, live API slugs, and the funding/quota state that blocks live QA.
---

# Gemini image provider routing

**Live Gemini API image slugs (verified via models API, July 2026):**
`gemini-2.5-flash-image` (the old `gemini-2.5-flash-image-preview` slug 404s — renamed),
`gemini-3.1-flash-image-preview`, `gemini-3.1-flash-image`, `gemini-3-pro-image-preview`,
`gemini-3-pro-image`, `gemini-3.1-flash-lite-image`.

**Rule:** the Gemini API **free tier grants ZERO quota for ALL image models** (429 with
`limit: 0`). Image generation via GEMINI_API_KEY requires paid billing enabled on the key —
a "working" key that serves text can still be useless for images.

**Provider coverage for the family:**
- Replicate: only `google/nano-banana` (=2.5 flash image) and `google/nano-banana-pro`
  (=3 pro, $0.139/img). NO 3.1-flash slugs.
- fal: `fal-ai/nano-banana/edit` and `fal-ai/nano-banana-pro/edit` — identity edits take
  `image_urls` (PLURAL array); the generic fal fallback's singular `image_url` +
  flux/schnell drops the face entirely.
- Direct Gemini API: the only place gemini-3.1-flash-image exists. ~$0.039/img flash,
  ~$0.24 pro.

**Why:** Spin/bulk swapped to `google/gemini-3.1-flash-image-preview` because Replicate
nano-banana behaved as a light EDIT model — anchored to reference framing, near-identical
low-res face crops ignoring scene specs.

**How to apply:** when adding/renaming a gemini image model, update the orchestrator's
gemini slug map + fal identity-edit map + registry cost together, and verify the slug
against the live models API first (slugs rot). Pollinations/flux candidates are
identity-blind — keep them LAST in image fallbacks and keep the image candidate cap large
enough that the free pollinations candidate still fits (Free-GPU-only mode must reach it).

**Funding snapshot 2026-07-03 (blocks live QA until user tops up):** Replicate 402
insufficient credit; fal 403 "User is locked. Exhausted balance"; Gemini key free-tier
(images impossible); no LOVABLE_API_KEY. Face-ref for live tests: /tmp/ref_url.txt
(signed URL, expires) — regenerate from the studio bucket if stale.
