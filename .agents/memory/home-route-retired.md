---
name: Retired /home route
description: /home unconditionally 307-redirects to /studio; home.lazy.tsx is unreachable dead code — signed-in surfaces belong on /studio.
---

`/home` was retired as a signed-in landing (owner decision 2026-08-11): `src/routes/home.tsx` `beforeLoad` throws `redirect({ to: "/studio" })` unconditionally, so `home.lazy.tsx` (persona toggle, tool rows, AdsSection…) renders for NOBODY.

**Why:** two competing signed-in front doors made the product feel like several different sites; `/studio` is the ONLY signed-in front door now.

**How to apply:** any "users can't find feature X after sign-in" report or new discovery surface must land on `/studio` (see `src/components/studio/DiscoverSections.tsx` pattern). Editing `home.lazy.tsx` has zero visible effect — same trap family as the unreachable `index.tsx` desktop header nav. Spin-dispatch template cards must never show "Free" — `templateCost()` returns 0 for them but `/spin` charges `spinTotalCost()` downstream.
