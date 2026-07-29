---
name: Aurora premium design system
description: The shared aurora-* utility layer + Button variants and the conventions for applying a cohesive premium look across surfaces.
---

Aurora has a shared premium visual language. Reuse it instead of hand-rolling a
glass/gradient recipe per surface.

## What exists
- `src/styles.css` `@layer components`: aurora-page-shell, aurora-ambient,
  aurora-glass / -strong, aurora-card (+aurora-card-hover), aurora-panel,
  aurora-hairline, aurora-elevated, aurora-glow-ring, aurora-kicker,
  aurora-gradient-text, aurora-focus-ring. Backing tokens: --surface-glass(-strong),
  --border-strong, --shadow-elevated, --shadow-glow-soft, --gradient-text (alongside
  pre-existing --gradient-hero/-soft/-stage and --primary-glow).
- `src/components/ui/button.tsx`: opt-in variants `premium` (gradient-hero CTA) and
  `glass`, plus sizes `xl` / `pill`. default/secondary/outline/ghost are unchanged.

## Conventions (the durable decisions)
- Page shell: outer = `aurora-page-shell`; first child = `<span aria-hidden
  className="aurora-ambient" />` (it is `position:absolute; inset:0;
  pointer-events:none`); and the real content wrapper gets `relative z-10` so the
  ambient glow can never overlay/block clicks. Landing (`index.tsx`) is the deliberate
  exception — it keeps its bespoke `bg-[#070612]` + radial glows.
- Convert hardcoded `white/alpha` surfaces and **brand** purple accents →
  primary tokens / aurora utilities for cohesion. Brand primary = electric violet
  `oklch(0.60 0.24 293)` `#8d54ff` (see aurora-theme-system.md; pale
  `oklch(0.72 0.20 300)` was owner-rejected as not premium/glowing).
- KEEP semantic status colors as-is: emerald/amber/rose/destructive/sky (scores,
  approvals, progress, success/error, admin). Never recolor those to brand primary.
- Eyebrow/overline labels → `aurora-kicker`; hero/section emphasis → `aurora-gradient-text`.

**Why:** Task #90 unified ~25 surfaces; without a shared layer each page drifted into
its own glass/gradient recipe. Centralizing keeps new surfaces consistent and makes a
re-theme a token edit instead of a per-file hunt.

**How to apply:** When building or restyling any route/component, prefer these utilities
+ Button variants over bespoke `bg-white/[0.0x] border border-white/10` or inline
gradient `style=`. Breakpoints are disabled (single column always) — do not add
sm/md/lg variants.
