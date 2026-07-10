---
name: orchestrateGenerate cameraMovement gap
description: quoteGenerate vs orchestrateGenerate motion-feature detection mismatch in src/lib/orchestration.functions.ts
---

`quoteGenerate`'s schema accepts `audioUrl`/`videoUrl`/`cameraMovement` and feeds them into `detectFeatures()`, which auto-adds `"motion"` to a video's feature stack when a camera movement preset is set. `orchestrateGenerate`'s `OrchestrateSchema` has no such fields, so its own `detectFeatures()` call at execution time can never see a `cameraMovement`, and can't reproduce that auto-added `"motion"` charge.

**Why:** the two handlers are meant to price identically (same `computeCost`/`detectFeatures` call shape) so a previewed quote always matches what's actually charged. The public API route (`src/routes/api/public/generate.ts`) *does* thread `motion` through both quote and charge correctly — `orchestrateGenerate` is the outlier.

**How to apply:** if a future task asks to unify quote/charge parity for the AI Router path, either drop `cameraMovement` from `QuoteSchema` (stop letting it advertise a stack it can't charge) or add the field to `OrchestrateSchema` and thread it into `orchestrateGenerate`'s own `detectFeatures` call. Not fixed as of 2026-07-10 (out of scope for the #65/#66 pricing-parity pass, which targeted `jobs.functions.ts`/`studio.functions.ts` and confirmed parity between the public API and AI Router's plain video/lipsync paths).
