---
name: UGC bundled-avatar staging
description: Curated/bundled reference images must be staged into the caller's own studio folder before dispatch — the ownership guard rejects Aurora-origin asset URLs.
---

# UGC bundled-avatar staging

Bundled marketing/UGC avatar images ship as same-origin `/__l5e/assets-v1/...` assets. The reference-image ownership guard rejects them: Aurora's own origin is not a trusted provider host, and those URLs match none of the owned-reference cases — so passing them directly fails every generation with "You can only use character images you own."

**Why:** the guard requires character references the caller owns; curated app assets are no exception.

**How to apply:** stage curated/bundled reference media (avatars, product shots) client-side into the caller's own studio folder once per session, then reference the studio URL — the guard accepts the studio path format and the orchestrator re-signs it before any provider fetch (same convention as the Studio demo selfie). Ownership/SSRF guards belong in the shared enqueue helpers, not the thin server-fn handlers, so smoke and future internal callers enforce them too.
