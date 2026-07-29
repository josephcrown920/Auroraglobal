---
name: Aurora theme system
description: Two-theme system (dark/light) via data-theme attribute; brand = electric violet oklch(0.60 0.24 293) #8d54ff with lavender glow accents. FOUC script, context hook, sidebar toggle.
---

# Aurora Theme System

## Rule
Two themes — dark (default) and light — controlled by `data-theme` attribute on `<html>`. Never use a `.dark` CSS class; Tailwind's `dark:` variants are unused.

## Brand palette (since 2026-07-29 — "premium glowing purple" restoration)
- **Primary (dark)**: electric violet `oklch(0.60 0.24 293)` = `#8d54ff` — extracted from the original production site's CSS bundle.
- **Primary (light theme)**: deeper `oklch(0.54 0.28 293)` (≈ `#7f22fe`).
- **Support tokens**: `--primary-glow oklch(0.70 0.17 294)` (`#a685ff`), `--primary-deep oklch(0.34 0.20 293)`; `--gradient-hero` runs 135deg 0.54/0.28/293 → 0.60/0.24/293 55% → 0.70/0.17/294.
- **Glow blooms**: lavender `oklch(0.775 0.148 307)` (`#cf9bff`) at 0.40–0.60 alpha in glow/shadow tokens. The old site went up to 0.8 alpha — headroom if the owner ever wants MORE glow.
- `--prime`/`--prime-glow`, `--ring`, `--sidebar-*`, `--color-brand`, and legacy `--brand-red*` aliases all point at this violet family now.
- Left alone on purpose: `--rec`/`--rec-glow` (red recording), `--destructive`, gold prime sub-theme (hue 85/88), canvas-node-glow keyframe (hue 305), decorative cyan→fuchsia gradient texts.

## Rejected directions (do NOT reintroduce)
- Pale violet `oklch(0.72 0.20 300)` — owner 2026-07-29: "wrong purple — not premium/glowing".
- Coral hue 25 (the earlier "editorial" redesign) — superseded when the owner asked for the original glowing purple back.
- Orange/gold — rejected as "yellow".

## Mechanics
- **CSS**: `:root` = dark theme; `html[data-theme="light"]` = white override. Both in `src/styles.css` — add any new color to BOTH blocks.
- **Context**: `src/lib/theme-context.tsx` — `ThemeProvider` + `useTheme()`; localStorage key `aurora-theme`.
- **FOUC prevention**: inline script in `RootShell` (`src/routes/__root.tsx`) head sets `data-theme` before first paint.
- **Toggle**: `src/components/MobileNav.tsx` sidebar footer (Moon/Sun pill).
- **Ambient**: `html[data-theme="light"] .aurora-ambient { display: none }`; `--gradient-stage: none` handles the light background.

## How to apply
Use semantic tokens (`bg-primary`, `var(--gradient-hero)`, `var(--shadow-glow-soft)`, …) — never hardcode purples in components. Inline literals are what made the 2026-07 restoration a multi-file hunt (home route, PageSpinner, tutorial tokens, showcase grids all had hardcoded values).
