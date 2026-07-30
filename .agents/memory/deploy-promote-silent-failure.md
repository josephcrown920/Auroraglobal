---
name: Silent promote failure diagnosis
description: How to tell an app-crash promote failure from a platform-side one on this project's autoscale deploys
---

**Rule:** Build logs for this repl ALWAYS end at `Creating Autoscale service` — success or failure; the promote error never appears there. Diagnose via runtime logs (`fetchDeploymentLogs` / RefreshAllLogs deployment source):

- Promote failed **WITH runtime log lines** → the container started and crashed (e.g. 2026-07-29 dangling-`node` ENOENT). Fix the app/config.
- Promote failed **with ZERO runtime log lines** → CAUTION: runtime logs can LAG the attempt (04:27 showed nothing; the near-identical 04:37 retry logged fully). Re-fetch later before concluding infra-side.
- **Flat-app promote failure mode (2026-07-30 04:37):** `not all artifact ports opened within timeout expected=[8080] detected=0` + endless `healthcheck / returned status 500` (synthetic — no upstream). pid1 runs the artifact process but does NOT hand it a PORT; nitro then binds its default (3000). Fix: force `PORT=8080` (the service's localPort) BOTH in `[services.env]` and inline in the production run command. Platform scaffolds (aurora-rollout) always carry PORT in `[services.env]` — a hand-written artifact.toml that omits it deploys a server on the wrong port.
- `healthcheckPath` is NOT a valid artifact.toml key — it is silently ignored; the startup probe hits `GET /`. Keep `/` returning 200.

**Local boot proof:** `PORT=5555 NODE_OPTIONS=--max-old-space-size=3072 bash scripts/replit-node.sh .output/server/index.mjs` then curl `/api/health` and `/` on 5555.

**Also learned:**
- `publicDir` in artifact.toml is **repo-root-relative** (original platform scaffold used `artifacts/aurora-rollout/dist/public`), not artifact-relative.
- `artifacts/aurora-rollout/dist` is **git-ignored but NOT replitignored** — the workspace copy ships in the deploy image. Keep it freshly built before publishing; a wiped workspace dist could deploy an empty static service. (Whether the deployer reruns the artifact's `npm run build` is unconfirmed — build-log head gets truncated.)

**Why:** Two consecutive failed publishes had entirely different causes (config bug vs silent infra); without this split, hours get wasted re-debugging healthy app config.

**How to apply:** On any "failed to publish" report: `listDeploymentBuilds` → newest failed build → `getDeploymentBuild` tail → then IMMEDIATELY check runtime logs; branch on presence/absence of container output before touching any config.
