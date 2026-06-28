---
name: Flat root app can't be made publishable by the agent in PNPM_WORKSPACE mode
description: Why an agent cannot register a deploy build/run command for a flat-root (non-workspace) app when .replit declares stack=PNPM_WORKSPACE + router=application, and what the real resolutions are.
---

# Registering a production run command is impossible from the agent for a flat-root app in workspace deploy mode

This repl is a flat ROOT app (app code at repo root, NO root `pnpm-workspace.yaml`; the
pnpm-workspace scaffold is parked in `.scaffold-backup/`). But `.replit` declares
`[agent] stack = "PNPM_WORKSPACE"` + `[deployment] router = "application"` +
`deploymentTarget = "autoscale"`, with NO `[deployment] build`/`run`. That is
artifact-mode deployment, where each artifact's `.replit-artifact/artifact.toml`
`[services.<name>.production]` owns build/run — but there is no valid web artifact.

**Every path to register a deploy build/run command is blocked for the agent:**
- Root `.replit-artifact/artifact.toml`: write tool blocks editing `artifact.toml`;
  shell `cp`/`mv` into that path is FS-guarded (same guard as `.replit`/`replit.nix`);
  `verifyAndReplaceArtifactToml` ENOENTs because it REQUIRES a pre-existing real
  `artifact.toml` to replace (can't bootstrap the first one).
- `.replit` is FS-guarded ("each setting owned by a tool/skill").
- No config callback exists: `deployConfig`, `setDeploymentConfig`, `configureDeployment`,
  `setStack`, `setReplitConfig` are ALL `undefined` in code_execution. (The deployment
  SKILL.md *references* `deployConfig()` but it is NOT exposed here.) Available callbacks:
  createArtifact, verifyAndReplaceArtifactToml, listArtifacts, getDeploymentInfo,
  suggestDeploy, fetchDeploymentLogs, viewEnvVars, configureWorkflow, restartWorkflow,
  removeWorkflow.
- `createArtifact` only scaffolds a NEW app at `artifacts/<slug>/` (needs the pnpm
  workspace; creates a `pnpm --filter @workspace/<slug> run dev` workflow; static serve).
  It cannot wrap an existing flat-root app; a "shim artifact at /" would restore the
  workspace, add a whole second app, and collide with the working `/` dev workflow.

**Why:** confirmed across sessions + an architect debug pass. The blocker is config
*ownership*, not app code. With `stack=PNPM_WORKSPACE`, `.replit [deployment] run` is
ignored; deploy config must live in an artifact.toml the agent can't create here.

**How to apply / real resolutions (in order):**
1. The app code CAN be made deploy-ready by the agent: set the deploy server to bind
   `process.env.PORT` and verify the exact build+run commands boot locally. Hand those to
   the user.
2. User registers the commands in the Publish UI ("Edit commands and secrets" / Advanced)
   — the only in-scope path. The UI can write `.replit [deployment]` even though the agent
   can't. (Uncertain whether the UI exposes these fields while in workspace mode.)
3. If the UI won't expose build/run (workspace mode), the repl must be switched out of
   `PNPM_WORKSPACE` by Replit support, OR the app migrated into a real `artifacts/<slug>/`
   workspace package (large, structure-changing — its own task).
4. Production also needs its own secrets: server reads `process.env.SUPABASE_URL`,
   `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — verify/add them in Publish
   secrets (dev secrets do NOT carry over automatically).
