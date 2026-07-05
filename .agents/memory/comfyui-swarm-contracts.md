---
name: ComfyUI swarm worker contracts & registration security
description: Filename/node-class contract between the ComfyUI launcher and the default graphs, and the self-registration trust model once image/video route swarm-first.
---

# ComfyUI free-GPU swarm (Kaggle/Colab) — contracts & trust

## Launcher ↔ default-graph filename/node contract
- The launcher's downloaded checkpoint filenames MUST match each default graph's
  `ckpt_name`/`model_name` **exactly** (e.g. SVD i2v graph wants
  `svd_xt_1_1.safetensors`, not `svd_xt.safetensors`). A mismatch does NOT fail at
  registration — it fails later at ComfyUI `/prompt` validation/model-load, so the
  worker advertises a cap it silently can't serve.
- Capability advertisement must **fail closed on two axes**: (1) weights present on
  disk AND (2) every custom node the graph references is actually **loaded**,
  checked against the keys of `GET /object_info`. Checking only a cloned
  custom-node *directory* is insufficient — a pack can clone yet fail to import
  (missing dep) and still leave the dir present.
- **How to apply:** when adding/altering a default graph or a cap, update the
  launcher's model map AND its `CAP_NODE_CLASSES` (exact class names from the graph
  JSON) in lockstep, then run `servable_caps` after `/system_stats` is healthy.

## Self-registration trust model (security) — RESOLVED
- `/api/public/workers/register` is now gated by a **private, operator-generated**
  `AURORA_REGISTER_SECRET` (`apikey` header) — see `worker-self-registration-tokens.md`.
  It is no longer the public Supabase anon/publishable key; the route fails closed
  (503) if the secret isn't configured, and never falls back to the anon key.
- **Why this mattered:** routing image/video swarm-first means a worker that
  self-registers is handed real job inputs (signed links to private user media) and
  trusted to return outputs, so an open register endpoint let anyone who knew the
  Aurora URL harvest media refs / return arbitrary results.
- **How to apply:** any existing custom (RunPod/VM) worker config must be updated to
  send the new secret; `/api/public/workers/health` (probes already-known workers,
  no new capability grant) intentionally stayed on the public anon key.
