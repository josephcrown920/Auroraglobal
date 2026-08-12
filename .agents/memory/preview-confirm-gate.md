---
name: Preview-confirm gate for temporal renders
description: How Aurora's video/lipsync preview-first cost guardrail works and the two traps found in review (ungated entry paths, preview pricing inversion).
---

# Preview-confirm gate (video/lipsync)

The rule: an unconfirmed temporal render (video/lipsync) is forced to a 480p/≤5s
preview recorded as `generations.mode='preview'`; the preview row's id is the
"ticket" passed back as `confirmPreviewId` to unlock full quality. Validation
(`validateConfirmedPreview` in cost-guardrails.server.ts) is pure and throws
TERMINAL "Unsupported preview confirmation: …" errors (matches
TERMINAL_ERROR_RE so queue jobs never retry a bad ticket). Ownership failure
folds into "not found" — no oracle.

**Why:** cost control — a human must see a cheap draft before the expensive
spend; a forged/expired ticket must fail loudly, never silently up/downgrade.

**How to apply:**
- The gate must cover EVERY temporal entry path, or it's decorative. Aurora has
  four: public API route, queue enqueue (jobs.functions), studio
  generateVideoFromImage, and AI-Router orchestrateGenerate. A voluntary
  `previewOnly` flag is NOT a gate — review found orchestrateGenerate relying
  on it and callers could just omit it.
- Pricing trap: paths that charge a FLAT full price (queue enqueue's
  creditCost) must not price the preview via model-tiered computeCost — for
  premium tiers the "cheap" preview then costs MORE than the full render
  (inversion). Preview price must derive from the same base as that path's
  full price (flat × 0.5).
- Deliberate exemption: sync lipSyncVideo is NOT gated — lipsync length is
  audio-driven, so a preview costs the provider the same while charging less
  (credit bypass). Only gate where the preview is genuinely cheaper to run.
- UI holding a ticket must drop it when the server throws "Unsupported preview
  confirmation" (terminal) or the button re-fails forever until reload.
- Tickets are multi-use within the 24h window; acceptable because every full
  render still pays full price.
- `resolvePreviewGate`/`validateConfirmedPreview` are pure READS — presenting a
  ticket never consumes it. So quote/estimate endpoints can (and should) accept
  `confirmPreviewId` to price the FULL render; without it they return the
  preview-capped price, which the UI then mislabels as the full-quality cost.
- Guard ORDER is not uniform across entry paths: orchestrateGenerate asserts
  the requested duration BEFORE the preview gate (over-cap blocks even the
  preview), but studio's video enqueue caps to preview length first, so an
  over-cap request via direct server-fn call slips into a 5s preview. Align
  new paths to guard-first, and don't promise "duration always blocks" for
  paths that cap first.
