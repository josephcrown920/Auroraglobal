# ComfyUI worker — free-GPU swarm (image · video · lipsync · motion)

For the `comfyui` protocol Aurora **sends the prompt graph itself** — you run stock
ComfyUI with the right custom nodes + weights, and Aurora `POST /prompt`s a graph,
polls `/history/{id}`, then fetches the result from `/view`. Aurora ships a default
graph for every kind and patches per-node inputs (prompt, input URLs, seed, steps…):

| file                                  | kind    | route when            | key nodes (must match) |
| ------------------------------------- | ------- | --------------------- | ---------------------- |
| `sdxl-image.workflow.json`            | image   | always                | `CheckpointLoaderSimple`, `CLIPTextEncode`, `KSampler`, `VAEDecode`, `SaveImage` |
| `svd-image-to-video.workflow.json`    | video   | an input image given  | `ImageOnlyCheckpointLoader`, `LoadImageFromUrl`, `SVD_img2vid_Conditioning`, `VideoLinearCFGGuidance`, `VHS_VideoCombine` |
| `animatediff-text-to-video.workflow.json` | video | no input image    | `CheckpointLoaderSimple`, `ADE_AnimateDiffLoaderGen1`, `CLIPTextEncode`, `KSampler`, `VHS_VideoCombine` |
| `latentsync-lipsync.workflow.json`    | lipsync | always (self-hosted)  | `LoadVideoFromUrl`, `LoadAudioFromUrl`, `LatentSyncSampler`, `VideoCombine`, `SaveVideo` |
| `mimicmotion-motion.workflow.json`    | motion  | always (self-hosted)  | `LoadImageFromUrl`, `LoadVideoFromUrl`, `MimicMotionSampler`, `VideoCombine`, `SaveVideo` |

The graph builders live in `src/lib/comfy-default-workflows.server.ts` (image/video),
`src/lib/lipsync-workflows.server.ts` and `src/lib/motion-workflows.server.ts`. The
JSONs here are **reference exports** (API format) — import them into the ComfyUI editor
to confirm your node class names match, and adjust the builders if a node pack renames
a class.

> **Routing:** `image`/`video` are **swarm-first** — Aurora tries the least-loaded
> online ComfyUI worker, then falls back to a hosted provider. `lipsync`/`motion` are
> **self-hosted only** — no hosted fallback, so a worker with those caps must be online.

## A · Free-GPU launcher (Kaggle / Colab) — zero-touch

`aurora_comfyui_launcher.py` installs ComfyUI + the node packs + weights, starts it on
`:8188`, health-gates on `/system_stats`, opens a **stable ngrok tunnel**, and
**auto-registers** as `protocol=comfyui` — advertising only the caps its VRAM,
installed models, **and loaded custom nodes** can actually serve. Restarting just re-runs the cell; the same static
domain re-registers the same row (Aurora de-dupes on the normalized URL).

### Secrets / env

Set on **Kaggle** under *Add-ons → Secrets*, on **Colab** via the 🔑 panel
(`google.colab.userdata`), or as plain environment variables:

| key | required | notes |
| --- | -------- | ----- |
| `NGROK_AUTHTOKEN` | yes | ngrok dashboard → *Your Authtoken*. |
| `NGROK_STATIC_DOMAIN` | yes | claim a free static domain (`dashboard.ngrok.com/domains`), e.g. `foo-bar.ngrok-free.app` — keeps the registered endpoint stable across restarts. |
| `AURORA_URL` | yes | your Aurora base URL, e.g. `https://your-app.replit.app`. |
| `AURORA_REGISTER_SECRET` | yes | a private secret **you generate** (e.g. `openssl rand -hex 32`) and set as `AURORA_REGISTER_SECRET` in Aurora's env too — the register `apikey`. **Never** the Supabase anon/publishable or service-role key. |
| `AURORA_WORKER_NAME` | optional | row name in Admin → Workers. |
| `AURORA_CAPABILITIES` | optional | force caps, e.g. `image,video`. Default by VRAM: `<20 GB → image,lipsync`; `≥20 GB → image,video,lipsync,motion`. A cap is advertised **only if** its weights are on disk **and** every custom node its graph references is loaded (verified against `/object_info`) after setup. |

### Run

1. **Kaggle:** new Notebook → *Settings*: Accelerator = **GPU**, Internet = **ON**.
   Add the secrets, paste `aurora_comfyui_launcher.py` into a cell, **Run**.
2. **Colab:** new Notebook → *Runtime → Change runtime type* = **GPU**. Add the
   secrets (🔑) or `os.environ[...]` at the top of the cell, paste the launcher, **Run**.

The cell prints `[register] OK — https://<domain> registered (caps=…)`. In Aurora,
**Admin → Workers** shows it **Active** with a fresh heartbeat, and the per-capability
capacity summary above the table counts its free slots.

> **Free-tier VRAM fit.** Kaggle/Colab free cards are ~16 GB → `image` + `lipsync`
> fit comfortably. `video` (SVD/AnimateDiff) and `motion` (MimicMotion) want ~20–24 GB,
> so they're only defaulted on a bigger card. The launcher **fails closed**: if a cap's
> weights don't download **or its custom nodes don't load**, the cap is dropped, never advertised — so Aurora won't route a job
> the worker can't run.

## B · Run ComfyUI yourself (any GPU host)

1. Install [ComfyUI](https://github.com/comfyanonymous/ComfyUI) and the custom-node
   packs that provide the classes in the table above:
   - `ComfyUI-VideoHelperSuite` — `VHS_VideoCombine` / `VideoCombine` / `Load*FromUrl`
   - `ComfyUI-AnimateDiff-Evolved` — `ADE_AnimateDiffLoaderGen1` (text-to-video)
   - a URL-loader pack (e.g. `comfyui-art-venture`) — `LoadImageFromUrl` / `LoadAudioFromUrl`
   - a LatentSync wrapper — `LatentSyncSampler` (lipsync)
   - a MimicMotion wrapper — `MimicMotionSampler` (motion)
2. Download the matching weights (SDXL for image; SVD + SD1.5 + an AnimateDiff motion
   module for video; LatentSync / MimicMotion checkpoints for lipsync / motion).
3. Start it listening on all interfaces:
   ```bash
   python main.py --listen 0.0.0.0 --port 8188
   ```
4. Register in **Admin → Workers**: Protocol `comfyui`, Endpoint `https://<host>:8188`,
   Capabilities = whatever you installed (e.g. `image,video,lipsync,motion`). Aurora
   appends `/prompt`, `/history`, `/view` itself, so the bare origin is enough.

> **Node names must match.** Aurora patches inputs by `nodeId.inputName` against the
> graphs above. If your custom nodes expose different class/input names, rename them or
> edit the default builders in the `*-workflows.server.ts` files.
