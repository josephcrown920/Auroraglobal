---
name: Mobile reference upload
description: How the Expo app must upload reference photos (no HTTP upload API) and why generate-API field names must be verified against the server schema.
---

# Mobile reference upload

**Rule:** Reference media must be uploaded directly to the private storage namespace owned by the signed-in user, then sent to generation using the exact server-defined field and a fresh signed URL. Every server entry point must validate both URL trust and ownership.

**Why:** Request schemas can silently discard unknown fields, while stale or foreign URLs can otherwise reach providers without a useful client-side signal.

**How to apply:** Read the receiving route's schema before changing a client payload, keep storage paths user-scoped, and cover upload, expiry, and ownership rejection in tests.
