---
name: Route-transition wrapper must never keep a transform
description: Why the app-shell route wrapper animates opacity only, and how a leftover transform broke the landing nav and fixed bars.
---

**Rule:** The pathname-keyed route-transition wrapper in the root layout animates `opacity` only. Never add `transform`/`translate`/`filter`/`will-change: transform` to it (or to any ancestor of route content), even inside an animation.

**Why:** `animation-fill-mode: both` keeps the final keyframe (`translateY(0)`) applied forever, and any non-none transform makes that element the *containing block* for every `position: fixed` and out-of-flow descendant. Symptoms seen 2026-09-04: the landing's absolute nav resolved against the wrapper, a collapsed `-mt-14` on the hero pulled it to y = -38 (Sign in / logo physically off-screen, unclickable) and fixed bottom bars inside routes pinned to the document bottom instead of the viewport.

**How to apply:** When a fixed/absolute element lands in the wrong place app-wide, check `getComputedStyle(wrapper).transform` first. Keep page-level absolute chrome (landing nav) anchored to a `relative` page root, and don't use negative top margins on the first in-flow child to "tuck under" an absolute header — it collapses through the page root and shifts the whole route.
