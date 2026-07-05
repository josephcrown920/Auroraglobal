---
name: Cookie consent region heuristic
description: Policy decision for deciding "is this visitor in a GDPR/UK/CA region" without any real IP-geolocation backend.
---

There is no IP-geolocation infra in this project, and standing one up was judged out of scope for a consent banner alone. Region is instead approximated client-side from two signals: the browser locale's region subtag, and the IANA timezone. Either signal alone is enough to treat the visitor as regulated — the heuristic is intentionally conservative in the direction of *showing* the banner and gating non-essential trackers, never toward silently skipping consent.

**Why:** a lightweight, zero-backend approximation was preferred over a new geolocation integration for a single feature; it's not perfectly precise, but false positives (showing the banner to a non-regulated visitor) are an acceptable cost, while false negatives (skipping consent for a regulated visitor) are not.

**How to apply:** any non-essential tracker/pixel loader (analytics, ad pixels, etc.) added to the app must be gated the same way consent-blocking already gates analytics session creation — check consent before initializing, and re-check on a consent-changed event so accepting later doesn't require a reload. Don't treat this heuristic as ground truth for anything beyond consent-gating (e.g. tax, shipping, precise legal jurisdiction) — add a real geolocation source if that's ever needed.
