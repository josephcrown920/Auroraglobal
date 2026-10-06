# Landing CTA hierarchy

## Goal

Reduce repeated generic “Start creating” calls to action on Aurora’s landing page without removing useful entry points or changing their destinations.

## Design

- Keep one generic, visually dominant “Start creating” action in the hero.
- Remove the anonymous visitor’s duplicate “Start creating” button from the header; keep “Sign in” there.
- Rename the first hero slide’s generic CTA to “Explore the studio →” so the slide action describes its destination.
- Rename the lower demo-section CTA to “Explore the studio” while preserving its existing `/studio` route and tracking event.
- Preserve signed-in behavior: “Open Studio” remains available in the header and hero.
- Preserve contextual actions such as “Create yours”, “Try a template”, and “See it in action”.

## Success criteria

- An anonymous landing-page visitor sees only one generic “Start creating” label.
- Header, hero, and demo-section actions remain keyboard-accessible links with their existing routes.
- No unrelated landing-page layout, copy, analytics, or feature behavior changes.

## Verification

- Run the landing route’s CTA text search.
- Run typecheck and lint.
- Confirm the landing route serves successfully and the hero remains accessible.