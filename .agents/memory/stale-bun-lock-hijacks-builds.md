---
name: Stale bun.lock hijacks remote builds
description: Any leftover bun.lock in this repo silently redirects remote builders (Replit deployer, EAS) to bun/old pins; npm package-lock.json is authoritative.
---

# Stale bun.lock hijacks remote builds

The repo is npm-managed (package-lock.json is authoritative), but Lovable-era `bun.lock` files linger. Remote builders that reinstall dependencies prefer/honor `bun.lock` when present:

- **Replit deploy builder (autoscale publish):** a stale root `bun.lock` (July 6) pinned `@tanstack/router-core` 1.168.17 while `package-lock.json` (July 20) had 1.171.15. The publish build failed in the SSR bundle with `"getScriptPreloadAttrs" is not exported by @tanstack/router-core` while local dev/build worked fine. Deleting root `bun.lock` fixed it (verified: local prod-build green).
- **EAS mobile builder:** same pattern — see eas-mobile-builds-from-replit.md (bun.lock in the app dir forced bun install, which dies on EAS).

**Why:** builds that pass locally (current node_modules) can fail remotely with baffling missing-export errors because the remote install resolved from the stale lockfile; the error points at the symptom package, not the lockfile.

**How to apply:** if a remote build fails with a missing export / version-skew error that local builds don't reproduce, first run `ls **/bun.lock` and compare the versions each lockfile pins. Delete any bun.lock — nothing in this repo should use bun for installs (bun is only the test runner).
