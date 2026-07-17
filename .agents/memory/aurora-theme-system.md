---
name: Aurora theme system
description: Two-theme system (dark/light) with data-theme attribute, FOUC script, context hook, and sidebar toggle. Brand accent is coral (NOT violet).
---

# Aurora Theme System

## Rule
Two themes — dark (default) and light — controlled by `data-theme` attribute on `<html>`. Never use a `.dark` CSS class; Tailwind's `dark:` variants are unused.

## How it works
- **CSS**: `:root` = dark theme; `html[data-theme="light"]` = white theme override. Both in `src/styles.css`.
- **Colors**: Dark = `oklch(0.085 0.022 272)` background + `oklch(0.58 0.22 25)` **coral** primary (hue 25). Light = `oklch(1 0 0)` white background + same coral.
- **Brand token**: `--color-brand: oklch(0.58 0.22 25)` — use `bg-brand`, `text-brand`, `border-brand` in Tailwind.
- **Prime exception**: `--prime: oklch(0.72 0.2 300)` violet is intentionally KEPT for the /agent Prime Director and /canvas route purple aesthetic. Do NOT change it.
- **Context**: `src/lib/theme-context.tsx` — `ThemeProvider` + `useTheme()` hook. Reads/writes localStorage `aurora-theme`.
- **FOUC prevention**: Inline script in `RootShell` (`src/routes/__root.tsx`) head — reads localStorage and sets `data-theme` before first paint.
- **Toggle**: In `src/components/MobileNav.tsx` sidebar footer (Moon/Sun icon + pill switch).
- **Ambient**: `html[data-theme="light"] .aurora-ambient { display: none }` — the dark glow is invisible in light mode; `--gradient-stage: none` handles background.

## Why
Owner asked for the app colors to match a reference screenshot (dark navy-black brand). A later "premium" redesign (zinc-950 dark, brand coral `oklch(0.58 0.22 25)`, Instrument Sans + Cormorant Garamond fonts, editorial aesthetic) was applied app-wide. The previous violet hue 300 was fully migrated to coral hue 25 as the brand primary. Canvas/agent pages keep their violet `--prime` intentionally.

## How to apply
- For any new color: add to both `:root` and `html[data-theme="light"]` blocks in `src/styles.css`.
- Use CSS variable semantic tokens (`bg-background`, `text-foreground`, `bg-primary`, etc.) everywhere — never hardcode oklch values in component files.
- `primary` = **coral** (`oklch(0.58 0.22 25)`, hue 25). Do NOT use orange/gold; owner rejected that as "yellow". Do NOT use violet/fuchsia (that was the old pre-redesign theme).
- `--prime` = violet (oklch 0.72 0.2 300, hue 300) — only for /agent and /canvas routes.
- Decorative gradient texts (cyan→fuchsia in editor, cli, BalloonLipsync, McpConnector) and artistic landing ambient blobs are intentionally kept as-is — they are atmospheric art, not brand UI.
