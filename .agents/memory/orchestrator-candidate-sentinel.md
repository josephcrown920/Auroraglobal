---
name: Orchestrator candidate-model sentinel
description: Why a new GenerateKind with no fallback models needs a sentinel model on its request, or orchestrate() silently never runs.
---

# Orchestrator candidate-model sentinel

When adding a new `GenerateKind` to `orchestrator.server.ts`, `orchestrate()` does
NOT iterate over providers directly — it first builds a candidate **model** list via
`getCandidateModels(req)` = `[req.model, ...FALLBACK_MODELS[kind]].filter(Boolean)`,
then for each candidate model filters `PRIORITY[kind]` adapters. If that candidate
list is empty, the loop body never executes, `triedAny` stays false, and it throws
"No provider available" **without ever calling the adapter** (e.g. gpuWorker).

**Why:** a backend-only kind (like `motion`/MimicMotion) has `FALLBACK_MODELS[kind] = []`
because there is no hosted model registry entry. If the caller also omits `req.model`,
candidates = [] and the GPU adapter is never reached — the request fails even though a
capable worker exists.

**How to apply:** for any kind whose adapter doesn't need a real model (GPU/ComfyUI
workers route by `capabilities`, not model), set a **sentinel model** on every request
for that kind (motion uses `MIMIC_MOTION_MODEL = "mimic-motion"` in
`buildMimicMotionRequest`). The adapter's `supports(r)` ignores the model, so the sentinel
just keeps the candidate loop non-empty. Don't rely on PRIORITY alone.
