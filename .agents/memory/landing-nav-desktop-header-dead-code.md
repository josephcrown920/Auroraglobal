---
name: index.tsx desktop header nav is unreachable
description: why editing the <header><nav> block in src/routes/index.tsx has no visible effect, and where the real nav lives
---

Aurora is forced single-column (see aurora-single-column-layout.md — breakpoints
disabled at 9990px+), so every `hidden sm:`/`md:`/`lg:inline-flex` class in the
`<header>` of `src/routes/index.tsx` never activates. That header nav row (Services,
Tutorials, Canvas, feature links, dropdowns) is effectively dead code on this build.

The nav a real user sees and interacts with is `src/components/MobileNav.tsx`:
a top hamburger button + bottom 4-tab bar (`TAB_ITEMS`) + a slide-out sheet listing
all features (`LIVE_FEATURES` / `UTILITY_FEATURES` / `COMING_SOON`).

**Why this matters:** any "simplify the navigation" or "reorder nav links" request
must be implemented in `MobileNav.tsx`, not the header markup in `index.tsx` — editing
the header alone will pass typecheck/tests and look right in isolated code review, but
produce zero visible change to the user.

**How to apply:** before touching top-nav UX, screenshot the live app first to confirm
which component is actually rendering what the user sees.
