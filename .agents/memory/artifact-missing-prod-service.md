---
name: Dev-only artifacts return 500 on the live site
description: Why an artifact path (e.g. /aurora-adult/) shows a bare "Internal Server Error" in production while the root app works
---

An artifact whose `.replit-artifact/artifact.toml` has NO `[services.production]` section is unreachable on the deployed site: the platform proxy has no production target for its path, so `GET /<path>/` returns a bare `Internal Server Error` (Google Frontend 500) even though the root app and its own routes are 200. In dev everything looks fine because the dev workflow serves the artifact on its localPort.

**Why:** production serving for each artifact is driven entirely by its own `artifact.toml` `[services.production]` block; without one the deployer never wires the path. This is distinct from the ENOENT-at-startup failure in deploy-dangling-symlink-node.md — there the prod service exists but its run cmd resolves a dangling `node`; here the prod service simply doesn't exist.

**How to apply:**
- If a dev-only artifact SHOULD be live, give it a `[services.production]`. For a client-only Vite SPA use `serve = "static"`, a `build` that runs vite through `scripts/replit-node.sh` (NOT bare `node`, NOT `pnpm` — this repo is flat npm/bun), `publicDir = "artifacts/<slug>/dist"`, and a rewrite `from = "/<slug>/*" to = "/<slug>/index.html"`. Pin `BASE_PATH` in the build env so asset URLs get the path prefix.
- If it should stay dev-only, the live site must not expose a link to it (per deploy-dangling-symlink-node.md, a prod service on a truly dev-only artifact can also take the whole deploy down).
- Verify before publishing: run the artifact's prod build locally, then `vite preview` the `dist` and curl `/<slug>/` for 200 + correct title. Confirm the asset `src`/`href` in `dist/index.html` are prefixed with `/<slug>/`.
- Note (2026-08-12): aurora-ds and aurora-mobile also 500 live for the same reason; only aurora-adult was in scope for the fix.
