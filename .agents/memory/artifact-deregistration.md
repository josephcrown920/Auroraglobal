---
name: Retiring registered artifacts / artifact-managed workflows
description: How to remove a registered Replit artifact and its auto-generated workflow when removeWorkflow is blocked.
---

# Retiring a registered artifact (and its managed workflow)

`removeWorkflow` FAILS on a workflow that belongs to a registered artifact:
`PROHIBITED_ACTION ... is managed by an artifact and cannot be deleted via deleteRunWorkflow`.

**To retire such an artifact:** delete its registration marker — the
`<artifact-dir>/.replit-artifact/artifact.toml` file (or the whole `.replit-artifact/`
dir). The platform then auto-deregisters and drops the managed workflow on its own,
emitting an automatic update like `Removed artifact: <title>`.

**Why:** artifact registration is discovered from `.replit-artifact/artifact.toml`
on the filesystem, not from `.replit`'s `[[workflows.workflow]]` blocks. The managed
workflow is owned by that registration, so the only control point is the marker file.

**How to apply:** when dead/broken registered artifacts crash the preview (e.g.
leftover `.scaffold-backup/artifacts/*` from a Lovable→Replit migration), `rm` their
`.replit-artifact` dirs rather than trying `removeWorkflow`. A flat app served at root
via a plain `outputType="webview"` workflow (e.g. `[[ports]] 8080->80`) needs ZERO
registered artifacts — the webview at root is the preview; an empty `listArtifacts`
is fine and does not blank the preview.
