---
name: Aurora landing muted-autoplay video hydration warning
description: Why the landing page emits a React hydration "attributes didn't match" console.error and why it's pre-existing/benign, not a per-component regression.
---

The Aurora landing page (TanStack Start, React 19, SSR) emits a console.error:
"A tree hydrated but some attributes of the server rendered HTML didn't match
the client properties. This won't be patched up." It shows up on desktop loads
and is easy to misattribute to whatever video component you just edited.

**Why:** It comes from `<video autoPlay muted loop playsInline ...>` elements.
React's SSR vs client handling of muted/autoplay video attributes mismatches.
Multiple landing components render these videos with the identical attribute set
(e.g. DemoReels, SplitReality, ServicesGrid, ViralEngine, TikTokSection), so the
warning is codebase-wide and predates any single component change. Verified by
inspecting SSR HTML: every `<video>` (including pre-existing demo-1.mov/demo-2.mov
from untouched ServicesGrid/ugc) carries the same `muted="" autoPlay="" playsInline=""`.

**How to apply:** Don't treat this hydration warning as a regression introduced by
editing one video component, and don't "fix" it in just one or two files (that
diverges from the established pattern). Functionally benign — videos still autoplay
muted; mobile smoke passes. If console cleanliness ever becomes a hard gate, fix it
GLOBALLY for all landing videos (shared wrapper using a muted ref / `suppressHydrationWarning`),
not per-component.
