---
name: Aurora theme system
description: Two-theme system (dark/light) via data-theme attribute; brand is VIOLET (hue ~295). History of the violet↔red flip-flops. Status colours must stay reserved — never use brand purple for errors.
---

# Aurora Theme System

## Rule
Two themes — dark (default) and light — controlled by `data-theme` attribute on `<html>`. Never use a `.dark` CSS class; Tailwind's `dark:` variants are unused.

## Brand palette — VIOLET (hue ~295)
- **Primary (dark)**: `oklch(0.60 0.27 295)`. `--color-brand`, `--primary`, `--primary-glow`, `--ring`, `--brand-red` (legacy name, holds violet) all sit at hue 295.
- Glow: `oklch(0.70 0.25 295)`. Deep: `oklch(0.30 0.22 295)`.
- Gradient accent (gradient-text mid-stop): `oklch(0.82 0.18 320)` — pink-violet.
- Tab bar accent strip: purple → pink-purple `linear-gradient(90deg, oklch(0.60 0.27 295), oklch(0.72 0.22 315))`.
- **Light mode primary**: `oklch(0.54 0.27 295)`.

**Why:** The owner's brand reference screenshots (screenshots of the deployed Lovable export) show consistent violet/purple across all pages — buttons, gradients, nav accents. Code had been incorrectly set to hue 25 (red) at some point; reverted to correct violet 2026-08-02.

## Reserved — do NOT change to violet
- `--destructive` (hue 27, `oklch(0.65 0.24 27)`) — error/delete UX. Must stay red.
- `--rec` and `--rec-glow` (hue 24) — recording indicator. Red is a universal convention.
- Status tokens: queued = amber, running = cyan/teal, done = emerald, error/failed = rose/red.

**Why:** a brand-wide colour sweep silently turns status glows brand-colour, making running jobs indistinguishable from failed ones. After any brand sweep, grep `running|processing` next to any new brand hue and verify `data-running` vs `data-error` in `src/styles.css` differ by hue not just lightness.

## Mechanics
- **CSS**: `:root` = dark theme; `html[data-theme="light"]` = white override. Both in `src/styles.css` — add any new colour to BOTH blocks.
- **Context**: `src/lib/theme-context.tsx` — `ThemeProvider` + `useTheme()`; localStorage key `aurora-theme`.
- **FOUC prevention**: inline script in `RootShell` (`src/routes/__root.tsx`) head sets `data-theme` before first paint.
- **Toggle**: `src/components/MobileNav.tsx` sidebar footer (Moon/Sun pill).

## Colour sweeps must cover both oklch syntaxes
A regex that only matches space-separated `oklch(0.60 0.27 295)` silently misses Tailwind arbitrary-value syntax written with underscores: `bg-[oklch(0.60_0.27_295/0.15)]`. Always sweep both forms.

When re-hueing a dark surface (L ≤ 0.3), clamp chroma to ~0.02 — carrying full chroma across turns near-black panels into muddy tinted blobs.

## How to apply
Use semantic tokens (`bg-primary`, `var(--gradient-hero)`) — never hardcode a brand colour in a component. Every brand flip so far has required a multi-file hunt through hardcoded literals in home route, MobileNav, ComposerHero, HomeTopBar, FormatChipRow, RecentProjectsGrid.
