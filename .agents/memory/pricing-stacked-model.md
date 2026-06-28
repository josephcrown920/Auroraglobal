---
name: Aurora stacked pricing model
description: Design rules & the additive-override security constraint for the shared pricing module (src/lib/pricing.ts).
---

# Aurora stacked (Kling/Runway-style) pricing

Single source of truth for cost: `src/lib/pricing.ts` (pure, no server imports so the
client UI can import it). Every charge/preview point must route through it so a quoted
preview can never disagree with what is reserved/charged: the public `/api/public/generate`
route, the AI Router server fns (`quoteGenerate` + `orchestrateGenerate`), and the AI
Router UI (`orchestrate.tsx`). The total is persisted via the existing `credits_cost`
field only — no DB migration.

## Durable design rules
- **Stacked, not flat:** a request is charged the SUM of every active feature's base, then
  resolution and length multipliers apply per-feature; the TOTAL is `Math.ceil`'d, min 1 for
  a non-empty request, empty → 0. Per-feature subtotals are kept exact so the itemized lines
  sum to the displayed total.
- **Resolution** scales video/motion always, and image ONLY when there is no temporal output
  (video/motion) in the stack (a source image under a video is base-only). This is what keeps
  the canonical worked example at exactly 39 Aura.
- **Length** scales only time-based features (video/lipsync/motion), linear vs `referenceSeconds`.

## Conservative detection (do NOT regress)
**Why:** so single-feature prices stay identical to before and charges are predictable.
`detectFeatures` derives billable features from EXPLICIT operations/inputs only — never from
prompt text and never from incidental reference artifacts. A start image for a video, or a
stray audio URL alone, must NOT add a billable feature. Add-ons only fire on explicit signals:
`motion` when a camera-control preset is supplied to a video; `lipsync` only for an unambiguous
audio+video pair on a non-lipsync primary.

## Override must be additive — never a credit bypass
**Why:** a caller-supplied `features[]` that REPLACES the primary kind lets someone submit
`kind:"video", features:["image"]` and reserve 1 Aura while running a video — a real billing
bypass (architect-flagged). 
**How to apply:** `detectFeatures` always folds the primary `kind` into the override set, so an
override can only ADD features (raise cost), never drop the kind. Keep it that way for any new
charge path. Also keep the quote API's accepted ranges identical to the executable charge
schema (e.g. duration 3–12) so a preview can't quote a length the generation rejects.
