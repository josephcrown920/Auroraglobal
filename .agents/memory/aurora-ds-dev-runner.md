---
name: Design-system artifact dev runner
description: Why aurora-ds (and any scaffolded artifact) can't run via pnpm here, and the fix pattern
---
Rule: artifact scaffolds that generate a `pnpm --filter <pkg> run dev` workflow command fail with `pnpm: command not found` in this repo.
**Why:** this workspace is a flat Lovable-export app using npm/bun lockfiles; pnpm was never installed despite the platform's monorepo default.
**How to apply:** give the artifact its own `start-dev.sh` (cd into dir, npm install if node_modules missing, resolve node via PATH then `available-pid2-node-paths`, exec `node node_modules/vite/bin/vite.js`), then update `[services.development].run` through verifyAndReplaceArtifactToml (needs tempFilePath + absolute artifactTomlPath). Pattern already used by aurora-adult and aurora-ds.
