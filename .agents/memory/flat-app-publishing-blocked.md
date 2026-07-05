---
name: One-click Publish for a flat-root app in PNPM_WORKSPACE mode (thin wrapper artifact)
description: How to give a flat-root (non-workspace) app a registered deploy build/run so the Publish button works in one click, when .replit declares stack=PNPM_WORKSPACE + router=application and the agent can't edit .replit directly.
---

# Make a flat-root app publishable via a thin wrapper artifact

This repl is a flat ROOT app (app code at repo root, NO root `pnpm-workspace.yaml`). `.replit`
declares `[agent] stack = "PNPM_WORKSPACE"` + `[deployment] router = "application"` +
`deploymentTarget = "autoscale"` with NO `[deployment] build`/`run` and NO `postBuild` (a
`postBuild` "pnpm store prune" hook used to exist and crashed every deploy with
`spawn pnpm ENOENT` — pnpm is NOT on the deploy image PATH; it was removed via
`verifyAndReplaceDotReplit`; keep `.replit` deploy hooks node/bash-only). That is
artifact-mode deployment: each artifact's `.replit-artifact/artifact.toml`
`[services.<name>.production]` owns build/run. `.replit [deployment] run` is IGNORED here and
`.replit` itself is FS-guarded, so the deploy command MUST live in an artifact.toml.

**Resolution that works (supersedes the old "impossible" conclusion):** `createArtifact` CAN
bootstrap the first real `.replit-artifact/artifact.toml` — that was the missing piece. Pattern:
1. `createArtifact({ artifactType: "react-vite", slug: "web", previewPath: "/", title })` →
   scaffolds an inert app at `artifacts/web/` AND a registered `artifact.toml`. Leave the
   scaffolded app UNUSED (it's just there to own the toml). It also auto-adds a workflow
   `artifacts/<slug>: <name>`.
2. `verifyAndReplaceArtifactToml` to rewrite that toml to point at the EXISTING flat-root app:
   - `[[services]]` web, `paths=["/"]`, **`localPort` = the existing dev port (8080)**. The
     global proxy routes "/" to this localPort — if it points at the inert scaffold's port
     (nothing listening) `curl localhost:80/` returns **502** and the dev preview breaks. Set it
     to the port the real "Start application" dev workflow already serves.
   - `[services.development] run` = the EXACT existing dev command (keeps the dev workflow as the
     source of truth; the auto-added `artifacts/<slug>` workflow becomes a harmless duplicate /
     stays not_started).
   - `[services.production] build`/`run` = the flat-root SSR build/run (here via
     `scripts/replit-node.sh` → real node; `vite build` → Nitro node-server `.output/server/index.mjs`
     binding `process.env.PORT`). No static serve.
   - `[services.env] BASE_PATH = "/"`.

**Gotchas:**
- Production build/run commands are repo-root-relative (`scripts/...`, `.output/...`). The
  PNPM_WORKSPACE deploy runner's CWD for an artifact's build/run is the REPO ROOT (the
  convention: workspace-package examples `cd` INTO their subdir, implying root default). Verified
  the root-relative commands boot locally; don't hardcode absolute paths.
- A long production `vite build` run as a detached bash process gets REAPED when the tool call
  ends (process group killed; not OOM). Run it as a MANAGED workflow (`configureWorkflow`,
  outputType console) instead, poll until `.output/server/index.mjs` exists, then `removeWorkflow`.
- `createArtifact` in this env needed a `node` symlink + a `{"type":"commonjs"}` shim in the
  artifacts skill dir to run (env-specific, see scratch backups).
- `removeWorkflow` is blocked for the artifact-managed `artifacts/<slug>: <name>` workflow — leave
  it; it's neutralized once its command equals the real dev command.

**Production secrets:** `userenv.shared` in `.replit` already carries `SUPABASE_URL` +
`SUPABASE_PUBLISHABLE_KEY` (and the VITE_ variants) into deploy. `SUPABASE_SERVICE_ROLE_KEY` is a
secret — confirm it's present in the Publish env or server-side calls fail in production.

**Validated & APPLIED (now live, not just a recipe):** the wrapper artifact `artifacts/web` is
registered with this exact toml; dev proxy "/" → 200 (real app); `vite build` →
`.output/server/index.mjs` + `.output/public`; `PORT=… node .output/server/index.mjs` → GET / 200
SSR; `.replit` unchanged; `.output` gitignored; `artifacts/web/.replit-artifact/artifact.toml`
tracked (root-anchored `/.replit-artifact/` does NOT match it). The untracked `artifacts/` tree is
committed by the end-of-task auto-commit — Publish reads the COMMITTED tree, so the fix only takes
effect after that commit lands.
