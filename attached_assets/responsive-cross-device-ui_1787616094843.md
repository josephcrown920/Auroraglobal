---
name: Make UI responsive across devices
description: Use when building or changing any web UI that real people will use on different screens — pages, dashboards, forms, marketing sites, customer-facing apps — so the layout works on phone, tablet, and desktop, not just the preview width.
---
**Activation:** On-demand — fires when building user-facing UI. Guardrail: it shapes Agent's layout/markup and it verifies phone/tablet/desktop widths.

# Instructions

Web apps built with Agent are expected to be responsive, but "looks right in the preview" is not the same as "works on a phone." Build mobile-first and verify on multiple widths, because customer-facing apps lose users on broken small-screen layouts.

- Design mobile-first: start from a single-column, small-screen layout and add complexity at larger breakpoints, rather than shrinking a desktop layout down.
- Use fluid, relative units and the framework's responsive utilities (e.g. Tailwind's responsive prefixes) instead of fixed pixel widths that overflow on small screens. Avoid horizontal scrolling.
- Make tap targets and text usable on touch: adequately sized buttons/links, readable base font size, no hover-only interactions for essential actions.
- Handle the common breakpoints: phone (~375–430px), tablet (~768px), desktop (~1024px+). Check that navigation collapses sensibly (e.g. a menu) and content reflows rather than clipping.
- Respect images and media: constrain to container width, use responsive image sizing, and don't let a large asset blow out the layout.
- Verify, don't assume: exercise the main screens at phone, tablet, and desktop widths in a real browser. On Replit, use App Testing where available and the Preview at different sizes.
- Keep accessibility in mind alongside responsiveness — readable text, visible focus states, and sufficient contrast matter at every screen size for customer-facing apps.

When done, report that the key screens were checked at phone/tablet/desktop and call out anything still rough. Don't claim "fully responsive" without having exercised small screens. Source: Replit Web Apps (responsive by default) and Preview/App Testing docs.
