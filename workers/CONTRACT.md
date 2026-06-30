# Aurora GPU worker — job contract

Aurora's orchestrator (`src/lib/orchestrator.server.ts`) routes self-hosted jobs to
any worker you register in **Admin → Workers**. This document is the single source of
truth for what Aurora sends a worker and what it expects back. Every template in this
directory implements this contract.

A worker advertises which **tasks** (capabilities) it can serve. Aurora only ever sends
a worker a task it registered for:

| task      | model              | inputs Aurora sends                        | output             |
| --------- | ------------------ | ------------------------------------------ | ------------------ |
| `lipsync` | LatentSync         | `video_url` (face) + `audio_url`           | talking-head video |
| `motion`  | MimicMotion        | `image_urls[0]` (ref) + `video_url` (pose) | animated video     |
| `image`   | SDXL-Turbo / FLUX  | `prompt` (+ optional `image_urls`)         | image              |
| `video`   | any                | `prompt` (+ optional `image_urls`)         | video              |
| `assemble`| ffmpeg (no model)  | `params.clips[]` + `params.narrations[]`   | stitched MP4       |

**What ships out of the box:**
- `aurora_worker.py` — `lipsync` + `motion` + `assemble` + **`image`** (SDXL-Turbo on T4, FLUX on A100+)
- `kaggle/` — `lipsync` default; add `image` via `AURORA_TASKS=image,lipsync`
- `runpod/` — `lipsync` + `motion`
- `comfyui/` — `lipsync` + `motion` via ComfyUI graphs
- `hf-space/` — `lipsync` or `motion` (one Space per task, Gradio arity-locked)

---

## Protocols

Aurora speaks four wire protocols, chosen by the worker's `protocol` field at
registration. Pick the one that matches your template.

### 1. `custom` / `vast` — flat HTTP `POST /generate`

Aurora `POST`s the **flat job body** to your `endpoint` (optionally with
`Authorization: Bearer <auth_token>` when you register one):

```jsonc
{
  "kind": "lipsync",                 // or "motion" | "image" | "video"
  "prompt": null,
  "image_urls": ["https://…/ref.jpg"],
  "audio_url": "https://…/voice.wav",
  "video_url": "https://…/face.mp4",
  "model": "latentsync",             // or "mimic-motion"
  "duration": null,
  "resolution": null,
  "params": { "inference_steps": 20, "guidance_scale": 1.5, "seed": 1247 },
  "workflow": { … },                 // only present for ComfyUI graphs
  "workflow_inputs": { … }           // "nodeId.inputName": value patches
}
```

**Response** — return the output URL in any of these shapes (Aurora's
`extractWorkerUrl` walks nested `output`/`result`/`data`/`video`/`url`/`path` keys):

```json
{ "url": "https://…/result.mp4" }
```

### 2. `runpod` — RunPod Serverless

Aurora wraps the **same flat body** under `input` and calls `/runsync` (or `/run` +
poll `/status/{id}` when async). Your handler returns the flat result; RunPod nests it
under `output`, which Aurora unwraps:

```jsonc
// what your handler receives:
{ "input": { "kind": "lipsync", "video_url": "…", "audio_url": "…", … } }
// what your handler returns:
{ "url": "https://…/result.mp4" }
```

### 3. `hfspace` — Gradio Space

Aurora calls the Space's `predict` fn over `/gradio_api/call/predict` + SSE. **Gradio
functions have fixed arity, so one Space serves one task.** Aurora sends positional
args in this exact order:

- **lipsync** → `(audio, media, mode)` — 3 args (`media` is the face video, `mode="video"`)
- **everything else** → `(prompt, image, audio, video)` — 4 args

Files are sent as `{ "path": "<url>", "meta": { "_type": "gradio.FileData" } }`.
Return the output as a URL string, or `{url}` / `{video:{url}}` / `{path}`.

### 4. `comfyui` — raw ComfyUI API

Aurora `POST`s a prompt graph to `/prompt`, polls `/history/{id}`, and reads the first
output asset's `/view` URL. For `lipsync` and `motion` Aurora **sends the graph for
you** (`workflow` + `workflow_inputs` in the body above) — you just run stock ComfyUI
with the LatentSync + MimicMotion custom nodes installed (see `comfyui/`).

---

## Registration cheat-sheet

| your template       | protocol  | endpoint example                                   | capabilities      |
| ------------------- | --------- | -------------------------------------------------- | ----------------- |
| `runpod/`           | `runpod`  | `https://api.runpod.ai/v2/<id>`                    | `lipsync,motion`  |
| `aurora_worker.py`  | `custom`  | `https://<host>/generate`                          | `lipsync,motion`  |
| `kaggle/`           | `custom`  | `https://<tunnel>/generate`                        | `lipsync,motion`  |
| `hf-space/` (lipsync) | `hfspace` | `https://<user>-<space>.hf.space`                | `lipsync`         |
| `hf-space/` (motion)  | `hfspace` | `https://<user>-<space>.hf.space`                | `motion`          |
| `comfyui/`          | `comfyui` | `https://<host>:8188`                              | `lipsync,motion`  |

> RunPod, Kaggle and the `custom` server carry `kind` in the body, so a single instance
> serves **both** tasks. HF Spaces are arity-locked to one task per Space.
