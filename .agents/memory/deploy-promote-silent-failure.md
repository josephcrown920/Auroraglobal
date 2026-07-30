---
name: Silent promote failure diagnosis
description: How to tell an app-crash promote failure from a platform-side one on this project's autoscale deploys
---

**Rule:** Build logs for this repl ALWAYS end at `Creating Autoscale service` — success or failure; the promote error never appears there. Diagnose via runtime logs (`fetchDeploymentLogs` / RefreshAllLogs deployment source):

- Promote failed **WITH runtime log lines** → the container started and crashed (e.g. 2026-07-29 dangling-`node` ENOENT). Fix the app/config.
- Promote failed **with ZERO runtime log lines** (2026-07-30 04:27 build) → the container was never started; service-creation/infra-level failure. If build ✓ + local boot of the exact production run command serves 200 on `/` and the healthcheck path, treat as transient platform issue → retry publish; if reproducible, get the exact error text from the user's Publish pane (it is not exposed via any agent API).

**Local boot proof:** `PORT=5555 NODE_OPTIONS=--max-old-space-size=3072 bash scripts/replit-node.sh .output/server/index.mjs` then curl `/api/health` and `/` on 5555.

**Also learned:**
- `publicDir` in artifact.toml is **repo-root-relative** (original platform scaffold used `artifacts/aurora-rollout/dist/public`), not artifact-relative.
- `artifacts/aurora-rollout/dist` is **git-ignored but NOT replitignored** — the workspace copy ships in the deploy image. Keep it freshly built before publishing; a wiped workspace dist could deploy an empty static service. (Whether the deployer reruns the artifact's `npm run build` is unconfirmed — build-log head gets truncated.)

**Why:** Two consecutive failed publishes had entirely different causes (config bug vs silent infra); without this split, hours get wasted re-debugging healthy app config.

**How to apply:** On any "failed to publish" report: `listDeploymentBuilds` → newest failed build → `getDeploymentBuild` tail → then IMMEDIATELY check runtime logs; branch on presence/absence of container output before touching any config.
