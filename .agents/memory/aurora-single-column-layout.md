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

## Landing route hydration warning (FIXED)
- The landing route (`/`) used to emit a React hydration-mismatch warning. Root cause was muted/autoplay `<video>` (NOT the slideshow, NOT `useAuth`/`StickyCreditsBar`/`ScrollProgress`). Now fixed — see `aurora-landing-video-hydration.md` (all landing videos go through the shared `AutoplayVideo` wrapper).
- **How to apply:** the slideshow component is correct — don't rewrite it. Don't reintroduce raw `<video muted autoPlay>` on landing or the warning returns.
