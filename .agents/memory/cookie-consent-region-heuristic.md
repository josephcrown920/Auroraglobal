---
name: Cookie consent region heuristic
description: How Aurora decides "is this visitor in a GDPR/UK/CA region" for the cookie-consent banner, without any real IP-geolocation backend.
---

There is no IP-geolocation infra in this project — `geo.functions.ts`'s `detectCurrency` is a stub that always returns `{currency: "USD", country: null}`. Standing up a real geolocation service was judged out of scope for a consent banner.

Instead, `src/lib/consent.ts`'s `isRegulatedRegion()` infers EU/UK/CA using two client-side signals combined:
1. `navigator.language` region subtag (e.g. `en-GB` → `GB`) checked against an EU/UK/EEA + CA country-code set.
2. `Intl.DateTimeFormat().resolvedOptions().timeZone` checked against `Europe/*` (+ a few Atlantic outliers) and a Canada IANA timezone list.

Either signal alone is enough to trigger "regulated" — it's intentionally conservative in the direction of *showing* the banner, never silently skipping consent.

**Why:** a lightweight, zero-backend approximation was preferred over adding a new geolocation integration for a single banner; it's not perfectly precise but errs safely.

**How to apply:** if a future feature needs real region/geo data (e.g. tax, shipping, precise legal jurisdiction), don't reuse this heuristic as ground truth — it's approximate. Consider adding a real IP-geolocation integration at that point instead of expanding this heuristic further.
