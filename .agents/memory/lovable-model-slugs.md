---
name: Lovable-exported model slugs may be invalid
description: Aurora's exported provider model slugs can be dead/hallucinated; verify each against the provider models API before trusting.
---

# Lovable-exported model slugs can be dead on arrival

Aurora (Lovable export) shipped Replicate lip-sync model slugs that 404 on Replicate's
API — they were never valid model paths. The core image/video slugs were fine; only the
secondary/fallback lip-sync ones were broken.

**Rule:** Before trusting any third-party model slug in this codebase, verify it exists:
`GET https://api.replicate.com/v1/models/<owner>/<name>` → 200 (valid) vs 404 (dead).
Also confirm the model's required input field names via its `latest_version.openapi_schema`
(`components.schemas.Input.properties` / `.required`) — different models use different keys
(e.g. sync uses `video`+`audio`; wav2lip uses `face`+`audio`).

**Why:** A smoke test of the full pipeline only failed at lip sync because the exported
slugs were invalid, not because the wiring or credit was wrong. The user has only
`REPLICATE_API_KEY` configured (no `SYNC_API_KEY`/`HEYGEN_API_KEY`/fal key), so lip sync
falls through to Replicate — meaning dead Replicate slugs break the feature entirely.

**How to apply:** When a feature 404s on a model create call, probe the provider's models
API for the correct slug rather than assuming the wiring is wrong. Lovable exports are a
likely source of hallucinated/outdated model identifiers.
