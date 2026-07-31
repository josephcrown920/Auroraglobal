---
name: Aurora theme system
description: Two-theme system (dark/light) via data-theme attribute; brand is RED (hue ~25). History of the red↔purple flip-flops and why red won. Includes the red-brand vs error-semantics trap.
---

# Aurora Theme System

## Rule
Two themes — dark (default) and light — controlled by `data-theme` attribute on `<html>`. Never use a `.dark` CSS class; Tailwind's `dark:` variants are unused.

## Brand palette — RED (hue ~24–25)
- **Primary (dark)**: `oklch(0.58 0.22 25)`. `--color-brand`, `--primary`, `--primary-glow`, `--ring`, `--brand-red` all sit in hue 24–25.
- The Prime/agent page palette (`--prime`, `--prime-glow`, `--canvas`, `--panel`, `--panel-2`, `--ink-dim`, `--gradient-text`, and the `canvas-node-*` keyframes) is **also** red-family. It used to be its own purple identity; the owner rejected that — see below.

**Why:** the owner's repeated, explicit preference. Purple has been tried twice and reverted twice.

## Rejected directions (do NOT reintroduce)
- **Any purple/violet as the brand.** Tried 2026-07-29 (pale violet `oklch(0.72 0.20 300)`, then electric violet `oklch(0.60 0.24 293)` / `#8d54ff`), reverted 2026-07-31.
- **A separate purple identity for the `/agent` (Prime Video Agent) page.** This is the specific thing that made the owner say the app "looks like a video agent" and that colours changed "red on sign-in, then purple after signup". The agent screen must wear the same brand as the rest of the app.
- Orange/gold — rejected as "yellow".

## The red-brand trap: brand vs status semantics
A red brand collides with the universal "red = error/destructive" convention. When recolouring toward red, **status colours must stay reserved**:
- queued = amber, running/processing = cyan/teal, done = emerald, error/failed = rose/red.

**Why:** a bulk violet→red sweep silently turned "running" spinners and canvas running-node glows red, making active jobs indistinguishable from failed ones.

**How to apply:** after any brand-wide colour change, grep for `running|processing` next to red/orange classes, and check `data-running` vs `data-error` styling in `src/styles.css` are different hues — not just different brightness.

## Mechanics
- **CSS**: `:root` = dark theme; `html[data-theme="light"]` = white override. Both in `src/styles.css` — add any new colour to BOTH blocks. There is also a third gold sub-theme block (hue 85/88) that is intentionally separate.
- **Context**: `src/lib/theme-context.tsx` — `ThemeProvider` + `useTheme()`; localStorage key `aurora-theme`.
- **FOUC prevention**: inline script in `RootShell` (`src/routes/__root.tsx`) head sets `data-theme` before first paint.
- **Toggle**: `src/components/MobileNav.tsx` sidebar footer (Moon/Sun pill).

## How to apply
Use semantic tokens (`bg-primary`, `bg-brand`, `var(--gradient-hero)`) — never hardcode a brand colour in a component. Every brand flip so far has been a multi-file hunt through hardcoded literals (home route, PageSpinner, tutorial tokens, chatbot, canvas panels, showcase grids). `src/components/landing/**` is styled separately from the app interior — a change to one does not cover the other.

## Colour sweeps must cover both oklch syntaxes

A regex that only matches CSS space-separated `oklch(0.72 0.2 300)` silently misses
Tailwind arbitrary-value syntax, where the same colour is written with underscores:
`shadow-[0_0_60px_oklch(0.72_0.2_300_/_0.3)]`. The first purple→red pass missed ~26
of these and left purple glows all over the app.

**How to apply:** sweep both forms. When re-hueing a dark surface (L <= 0.3), clamp
chroma to ~0.02 as well — carrying the original chroma across to the red hue turns
near-black panels muddy maroon.
