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

## Self-registration trust model (security)
- `/api/public/workers/register` is gated by the **public** Supabase anon/publishable
  key (`apikey` header) — the same key shipped to browsers (see
  `worker-self-registration-tokens.md`). It is effectively open.
- **Why it matters more now:** routing image/video swarm-first means a worker that
  self-registers is handed real job inputs (signed links to private user media) and
  trusted to return outputs. So anyone who learns the Aurora URL can register a
  "worker", harvest media refs, and return arbitrary results.
- **How to apply:** this is a pre-existing, deliberate pattern (don't silently
  "fix" it inside an unrelated task — it would break existing custom workers). Real
  remediation = a dedicated operator registration secret or an admin approval queue;
  filed as a follow-up task.
