---
name: Aurora single-column full-screen layout
description: Why Tailwind breakpoints are disabled, how fixed chrome is positioned full-screen, and the benign landing hydration warning
---

# Aurora single-column / full-screen layout

- Aurora intentionally disables ALL Tailwind breakpoints (`--breakpoint-sm..2xl` set to 9990px+ in `src/styles.css` `@theme`) so the whole app always renders its base (mobile) single-column layout on every device.
  - **Consequence:** `sm:` / `md:` / `lg:` / `xl:` / `2xl:` utilities NEVER apply. Do not add responsive variants expecting them to work — style the base classes instead.
- The app fills the full viewport (the old centered 440px "phone frame" was removed). Viewport-fixed chrome (nav, drawer, floating buttons, side panels) is positioned by custom helper classes defined OUTSIDE `@layer` so they beat Tailwind position/size utilities: `.phone-fixed-x` (full-width top/bottom bars), `.phone-edge-left`/`.phone-edge-right` (edge-anchored floating buttons), `.phone-drawer-left`, `.phone-panel-col` (capped at 28rem).
- **Why:** user chose "stretch the single column to fill the whole screen" over a responsive desktop redesign. A "bottom nav not showing" bug was actually `.phone-fixed-x` capping the bar to a 440px centered column — fixed by making the helper full-width. The nav always rendered (it's in the SSR HTML); it was just a narrow centered bar.
- `--aurora-phone-max` (440px) is legacy/unused after the full-screen change.

## Landing route hydration warning (benign)
- The landing route (`/`) emits a React hydration-mismatch warning in the browser console, but React recovers and client effects DO run — the `JoshSlideshow` `setInterval` auto-advance works (verified via e2e: caption changes on its own every ~3.2s).
- Ruled out as sources: `useAuth()` (null on both SSR and first client render), `StickyCreditsBar`/`ScrollProgress` (render null / zero-width on first render). Date/`Math.random` usages are on other routes, not `/`.
- **How to apply:** the slideshow component itself is correct — don't rewrite it. Only chase the hydration warning if you can capture the FULL (untruncated) console stack/component trace; otherwise it's not worth blocking on.
