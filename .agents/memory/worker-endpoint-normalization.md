---
name: Worker endpoint URL normalization
description: Why every code path that appends to a GPU worker endpoint_url must normalize in lockstep
---

# GPU worker endpoint_url normalization

Any code path that builds a URL from a registered worker's `endpoint_url` must first
pass it through `normalizeWorkerBase()` (strips trailing slashes + a trailing
`/generate`). Today that means BOTH the orchestrator dispatch base and the health
probe base.

**Why:** the custom/Vast worker (`workers/aurora_worker.py`) actually *serves* its job
route at `.../generate`, so operators — and the Colab/Kaggle/README templates — naturally
register that full URL. Dispatch appends `/generate` and the health probe appends
`/health`. Without normalization you get `.../generate/generate` (job fails) and
`.../generate/health` (worker looks permanently down). RunPod/ComfyUI/HF URLs never end
in `/generate`, so normalization is a no-op for them.

**How to apply:** if you add a new protocol or a new place that concatenates onto
`endpoint_url`, route it through `normalizeWorkerBase` too — keep dispatch and health in
lockstep so "register the bare origin" and "register the full /generate URL" both work.
