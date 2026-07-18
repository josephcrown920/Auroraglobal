---
name: Publish build heap cap
description: The production build's Node heap cap lives in artifacts/web artifact.toml and must fit the 4GB deploy builder
---

The Replit publish builder for this app is `cr-2-4` (2 vCPU, **4 GB RAM**) — smaller than the ~7GB dev container. The production build command in `artifacts/web/.replit-artifact/artifact.toml` carries an explicit `NODE_OPTIONS=--max-old-space-size=<MB>` cap.

**Why:** July 2026 publish builds failed 3× with "JavaScript heap out of memory" — the cap was 2048 MB and the app had outgrown it (crash exactly at ~1.97 GB heap during `vite build`). Bumped to 3072 MB (leaves ~1 GB non-heap headroom on the 4 GB builder); verified via the `prod-build` validation command.

**How to apply:** if publish OOMs again, first prefer SSR-stubbing huge client-only libs (see monaco-ssr-build-oom.md); only then adjust the cap — but never above ~3072 on a 4 GB builder. Edit artifact.toml via `verifyAndReplaceArtifactToml` (temp-file flow), never directly. Diagnose publish failures via `listDeploymentBuilds` → `getDeploymentBuild(id)`; the OOM lines are buried under hundreds of `inputValidator() is deprecated` warnings — filter, don't tail.
