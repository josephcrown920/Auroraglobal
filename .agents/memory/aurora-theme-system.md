---
name: Aurora theme system
description: Two-theme system (dark/light) with data-theme attribute, FOUC script, context hook, and sidebar toggle.
---

# Aurora Theme System

## Rule
Two themes — dark (default) and light — controlled by `data-theme` attribute on `<html>`. Never use a `.dark` CSS class; Tailwind's `dark:` variants are unused.

## How it works
- **CSS**: `:root` = dark theme; `html[data-theme="light"]` = white theme override. Both in `src/styles.css`.
- **Colors**: Dark = `oklch(0.085 0.022 272)` background + `oklch(0.73 0.19 44)` orange primary. Light = `oklch(1 0 0)` white background + same orange.
- **Context**: `src/lib/theme-context.tsx` — `ThemeProvider` + `useTheme()` hook. Reads/writes localStorage `aurora-theme`.
- **FOUC prevention**: Inline script in `RootShell` (`src/routes/__root.tsx`) head — reads localStorage and sets `data-theme` before first paint.
- **Toggle**: In `src/components/MobileNav.tsx` sidebar footer (Moon/Sun icon + pill switch).
- **Ambient**: `html[data-theme="light"] .aurora-ambient { display: none }` — the dark glow is invisible in light mode; `--gradient-stage: none` handles background.

## Why
Owner asked for the app colors to match a reference screenshot (dark navy-black + orange brand) and wanted an all-white switchable theme with a toggle in the sidebar, applied consistently across all pages.

## How to apply
- For any new color: add to both `:root` and `html[data-theme="light"]` blocks in `src/styles.css`.
- Use CSS variable semantic tokens (`bg-background`, `text-foreground`, `bg-primary`, etc.) everywhere — never hardcode oklch values in component files.
- `primary` = orange; never revert it to purple/violet.
