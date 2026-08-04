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

## Full-screen editor routes must opt out of global chrome in `__root.tsx`
- `MobileNav` (bottom tab bar) and `AuroraChatbot` (floating bubble) are rendered globally from `src/routes/__root.tsx` and OVERLAY any route that owns the whole viewport (`h-dvh` header/stage/dock layouts). A new full-screen route's bottom dock will render but sit underneath the opaque tab bar.
- **Fix:** extend the existing pathname exclusions in `__root.tsx` (pattern: `isVideoAgent`, `isFullScreenEditor` for `/edit`) — don't try to out-z-index the nav or pad around it.
- **How to apply:** any time a route is built as a self-contained full-screen tool (own bottom action bar), add it to those exclusions and screenshot to confirm.

## Fixed chrome trapped by a `relative z-0` ancestor
- A `position:relative` wrapper with an explicit `z-0` (or any numeric z-index, even 0) creates its OWN stacking context — any `fixed`/`z-30` descendant inside it is capped at that context's level and can render BELOW unrelated siblings with a higher z-index (e.g. a `relative z-10` header), even though the descendant's own z-index looks higher in isolation.
- **Symptom:** a new fixed-position toggle/panel appears in the DOM (no console errors, visible in accessibility snapshot) but clicks on it fail with "header intercepts pointer events" — it LOOKS present but is fully unclickable in the overlapping region.
- **Fix:** render viewport-fixed chrome (docked panels, floating toggles) as a direct child of the page's root container (no `z-0`/`z-*` positioned ancestor between it and root), not nested inside a canvas/content wrapper that has its own z-index.
- **Also relevant:** `hidden md:flex` is ALSO dead here per the breakpoint note above — both bugs can compound (see `ExportShareDock` in canvas.tsx, still has the `hidden md:flex` issue, unfixed/out of scope as of 2026-07).

## Landing route hydration warning (FIXED)
- The landing route (`/`) used to emit a React hydration-mismatch warning. Root cause was muted/autoplay `<video>` (NOT the slideshow, NOT `useAuth`/`StickyCreditsBar`/`ScrollProgress`). Now fixed — see `aurora-landing-video-hydration.md` (all landing videos go through the shared `AutoplayVideo` wrapper).
- **How to apply:** the slideshow component is correct — don't rewrite it. Don't reintroduce raw `<video muted autoPlay>` on landing or the warning returns.
