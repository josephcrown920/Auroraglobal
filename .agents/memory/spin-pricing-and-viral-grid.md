---
name: Spin drawer pricing & ViralEngine grid sizing decisions
description: Why the Spin template drawer shows a second pricing row, and why the ViralEngine landing grid was capped to 6 tiles instead of resized proportionally.
---

Spin templates are free-to-preview but cost Aura to render for real (30 pieces x 1 Aura). The TemplateDrawer's pre-existing "Free live preview" row didn't communicate that, so users hit the real cost as a surprise once inside Spin Studio.

**Why:** user reported (via screenshot) that the Spin modal "doesn't show real Aura pricing" before generating.

**How to apply:** any pricing UI shown before a Spin render must call `templateCost(template)` from `src/lib/template-studio.ts` — the same helper Spin Studio itself uses — rather than hardcoding a number, so the preview and the real charge can never drift.

Separately, the ViralEngine.tsx landing mockup (TikTok-style phone grid) was cut from 4 rows x 12 tiles (aspect-[3/4]) to 2 rows x 6 tiles (aspect-square) rather than just shrinking the phone frame width, because the tile count/aspect ratio was the actual height driver, not the frame width.

**Why:** user flagged the mockup as "too tall/large," making an already-long landing page worse.

**How to apply:** the reveal/spin animation still counts up to the full PIECES.length (12) for the "Spinning n/12" copy and the "See all 12 in Spin Studio" CTA, since those are real promises about full Spin Studio output — only the visual grid array is `.slice(0, 6)`. If tuning this again, keep the promised piece count and the visible tile count independent; don't let a grid-size change silently alter the marketing claim.
