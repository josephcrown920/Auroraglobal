---
name: Deploy image dangling symlinks & artifact prod services
description: Why a deployment can die at runtime with fork/exec ENOENT, and which artifacts belong in prod
---

July 2026 publish failure: build + upload succeeded, then the whole deployment was killed at startup. Cause: aurora-mobile's `[services.production]` run cmd `["node", "server/serve.js"]` resolved `node` → `.pythonlibs/bin/node`, a symlink whose target doesn't exist inside the production image → fork/exec ENOENT → deployer tears down everything.

**Rules:**
- Dev-only artifacts (Expo app, mockups, internal tools) must have NO `[services.production]` section — any prod service they declare can take the whole deployment down with it.
- Never use bare `node` in a production run command; the prod image PATH can resolve it to a dangling symlink. Use `scripts/replit-node.sh` / explicit resolution (see replit-node-resolution-fallback.md).
- `.replitignore` includes `.pythonlibs` (dev-only python venv, 72MB, its bin/node symlink poisons PATH in the image). Keep it there.
- Static artifacts' `publicDir` must match the REAL vite output dir (aurora-rollout outputs `dist`, not `dist/public`) — verify with a local build before publishing.

**How to apply:** when a publish fails after a successful build phase, check the runtime section of the deployment log for ENOENT on the run command before touching build config.
