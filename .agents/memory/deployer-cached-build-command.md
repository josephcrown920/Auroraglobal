---
name: Deployer cached build command
description: The Replit autoscale deployer has `node scripts/build.js` stored server-side as its build command for this project.
---

# Deployer cached build command

The Replit autoscale deployer (cloud_run) has `node scripts/build.js` stored server-side as the build command. This was set in the Publish UI before `artifacts/web/.replit-artifact/artifact.toml` existed, and the service never cleared it.

**Symptom:** builds fail immediately with `Error: Cannot find module '/home/runner/workspace/scripts/build.js'` (~8–14 seconds total, no vite output).

**Why alternating:** When the platform re-reads the artifact.toml (e.g. after a config change) it uses the artifact.toml build command instead. Otherwise it uses the cached `node scripts/build.js`. This is non-deterministic from the code's perspective.

**Fix in place:** `scripts/build.js` now exists and delegates to `scripts/replit-node.sh node_modules/vite/bin/vite.js build` with `NODE_OPTIONS=--max-old-space-size=3072`, so both the cached command and the artifact.toml command produce a correct vite build.

**How to apply:** If `scripts/build.js` is deleted or renamed, the cached deployer command will break again. Keep it as a permanent entry point.
