---
name: Publish build heap cap
description: Both the production build AND run commands in artifact.toml need NODE_OPTIONS heap caps; the 4GB builder/runtime OOMs without them
---

The Replit publish builder for this app is `cr-2-4` (2 vCPU, **4 GB RAM**) — smaller than the ~7GB dev container. Both the production **build** and **run** commands in `artifacts/web/.replit-artifact/artifact.toml` must carry an explicit `NODE_OPTIONS=--max-old-space-size=<MB>` cap.

**Why:** July 2026 publish builds failed with OOM — originally the build cap was 2048 MB and was bumped to 3072 MB. Later (July 24 2026), the app started failing at the **promote step** (health-check on `/api/health` never responded) even though the Vite build completed fine. Root cause: the **run** command lacked a heap cap — `scripts/replit-node.sh` does a bare `exec "${NODE_BIN}" "$@"` without inheriting NODE_OPTIONS, so the server OOM-crashed at startup while loading the SSR bundle. Adding `NODE_OPTIONS=--max-old-space-size=3072` to the run command fixes the promote failure.

Current commands in artifact.toml:
- `build`: `["bash", "-c", "NODE_OPTIONS=--max-old-space-size=3072 exec bash scripts/replit-node.sh node_modules/vite/bin/vite.js build"]`
- `run`: `["bash", "-c", "NODE_OPTIONS=--max-old-space-size=3072 exec bash scripts/replit-node.sh .output/server/index.mjs"]`

**How to apply:** if publish OOMs again, first prefer SSR-stubbing huge client-only libs (see monaco-ssr-build-oom.md); only then adjust the cap — never above ~3072 on a 4 GB builder. Edit artifact.toml via `verifyAndReplaceArtifactToml` (temp-file flow), never directly.

**Diagnosing build vs promote failures:** Vite build logs show module counts and asset sizes. If the build phase completes (all chunks rendered) but status is still `failed`, the failure is at the **promote step** (health check). Check `healthcheckPath` in artifact.toml (currently `/api/health`) and fetch runtime logs with `fetchDeploymentLogs`. A promote failure with no runtime logs means the server crashed before accepting any connection — OOM is the primary suspect.
