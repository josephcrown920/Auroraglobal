---
name: Aurora raw media file imports
description: How to reference an attached/uploaded raw media file (mp4/png) from Aurora landing components without a broken import.
---

`@assets/<file>` is NOT a configured alias in the root `vite.config.ts` that actually runs the dev server (only `@` → `src/` is defined there; a stray `@assets` alias exists in the unused `artifacts/web/vite.config.ts`). Importing a raw file from `attached_assets/` via `@assets/...` fails at runtime with `ERR_MODULE_NOT_FOUND` — it doesn't get caught by typecheck/lint, only by actually loading the page.

Aurora's asset pipeline expects hosted `.asset.json` pointer files under `src/assets/` (e.g. `foo.mp4.asset.json`, imported as a JSON module whose `.url` field is a CDN URL) for internally-generated media.

**How to apply:** for a newly attached/uploaded raw local media file (not yet hosted), copy it into `public/videos/` (or another `public/` subfolder) and reference it as a plain string URL path (e.g. `"/videos/my-file.mp4"`), not an ES import. `public/videos/user-reference.mp4` already exists as a precedent for a raw (non-asset.json) file living directly in `public/`.
