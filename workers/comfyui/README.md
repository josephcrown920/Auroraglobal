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

`aurora_comfyui_launcher.py` installs ComfyUI (current master, 0.31+) + the node packs +
weights + `comfy-cli` (for on-demand `comfy node install <pack>` inside the session), starts it on
`:8188`, health-gates on `/system_stats`, opens a **stable ngrok tunnel**, and
**auto-registers** as `protocol=comfyui` — advertising only the caps its VRAM,
installed models, **and loaded custom nodes** can actually serve. Restarting just re-runs the cell; the same static

> **Optional — broad node set:** set `AURORA_INSTALL_ALL_NODES=1` before launch to also install a
> curated "everything" pack list (ComfyUI-Manager, LTX-Video, WanVideoWrapper, controlnet_aux,
> Impact-Pack, KJNodes, essentials, rgthree, WAS suite, IPAdapter+, Frame-Interpolation, …).
> ComfyUI-Manager + comfy-cli then cover any remaining registry pack on demand. Capability
> advertisement still fails closed on `/object_info`, so extra packs never over-advertise.
> Reference blueprints from current ComfyUI (Flux.2, Z-Image, LTX-2.3, Wan 2.2) live in
> `workers/comfyui/blueprints/`.
>
> **Boot-time budget (estimated — instrumented for live confirmation).** With
> `AURORA_INSTALL_ALL_NODES=1` on a Kaggle/Colab free GPU session, the full install is
> **estimated at ~13 minutes cold** (≤10 min when the HF model cache is warm): ComfyUI
> clone ~30 s, base pip deps ~90 s, 16 node packs ~5–8 min, SDXL weights ~3 min cold/0 s
> cached, ComfyUI startup + `/system_stats` health gate ~90 s. These figures come from
> per-step dry-run measurements, not yet a full live session; the launcher now prints a
> per-pack completion duration (`[nodes] [i/16] <pack> done in Ns`) and an end-to-end
> summary after the health gate (`[boot] healthy: setup Xs + startup/health Ys = Zs total`),
> so the first real session log will confirm or correct the budget. The curated set is
> locked to exactly 16 packs by a module-level guard and `test_launcher.py`. Disk overhead
> is ~2.4 GB extra on top of the base image — well within Kaggle's ~19 GB working-directory
> limit. The 12-hour session budget is never a constraint; >98 % headroom remains after boot.
> Pack failures print a loud `WARNING` but never abort the boot — the `/object_info`
> fail-closed check then simply drops any cap whose node classes didn't load.

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

## C · Vast.ai — official "Recommended" `vastai/comfy` template

Renting Vast's own **ComfyUI** template (search Vast's console for "Recommended" →
`vastai/comfy`) is the fastest way to get a paid, always-on `comfyui` worker — but the
stock image only ships base ComfyUI + a few general-purpose node packs. It is
**missing every node pack `lipsync`/`motion` need**, so a fresh rental only safely
advertises `image` (and `video` if AnimateDiff/SVD nodes+weights are present) until you
install the rest. Skipping this step doesn't error loudly — Aurora just never routes
`lipsync`/`motion` jobs there because the launcher's own `/object_info` check (see
"fails closed" above) won't find the classes.

1. **Rent the instance.** Vast console → Templates → search "comfy" → pick the
   "Recommended" `vastai/comfy` template → rent an instance with ≥16 GB VRAM (24 GB+ if
   you also want `motion`). Vast exposes ComfyUI's port directly on a public
   `<host>:<port>` — no tunnel needed (same as the `custom`/Vast section in
   `workers/README.md`).
2. **Open a terminal on the instance** (Vast console → Instance → "Open" → Jupyter/SSH)
   and install the missing node packs into ComfyUI's `custom_nodes/` dir:
   ```bash
   cd /opt/ComfyUI/custom_nodes   # path varies by template version — confirm with `pwd`/`ls /opt`
   git clone https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git
   git clone https://github.com/Kosinkadink/ComfyUI-AnimateDiff-Evolved.git
   git clone https://github.com/christian-byrne/comfyui-art-venture.git   # or any URL-loader pack providing LoadImageFromUrl/LoadAudioFromUrl
   # LatentSync + MimicMotion wrapper nodes (pick the wrapper repo matching the
   # class names in the table above — check ComfyUI Manager's registry if these
   # repo names have moved):
   git clone <latentsync-comfyui-wrapper-repo>
   git clone <mimicmotion-comfyui-wrapper-repo>
   for d in */; do [ -f "$d/requirements.txt" ] && pip install -r "$d/requirements.txt"; done
   ```
3. **Fetch the weights** the same wrapper nodes expect (SVD + an AnimateDiff motion
   module under `models/checkpoints` / `models/animatediff_models`; LatentSync +
   MimicMotion checkpoints wherever their wrapper node's README specifies — these are
   the same checkpoints `workers/setup.sh` downloads for the `custom` protocol, so you
   can reuse that script's URLs instead of hunting for them again).
4. **Restart ComfyUI** (`supervisorctl restart comfyui` or the template's restart
   script) and confirm the new classes are loaded:
   ```bash
   curl -s localhost:8188/object_info | python3 -c "import sys,json; d=json.load(sys.stdin); print([k for k in d if 'LatentSync' in k or 'MimicMotion' in k or 'VHS_' in k or 'ADE_' in k])"
   ```
   An empty list means a node pack failed to import — check ComfyUI's own startup log
   for the real import error (missing Python dep is the usual cause) before registering.
5. **Register in Admin → Workers**: Protocol `comfyui`, Endpoint `https://<host>:<port>`
   (Aurora appends `/prompt`/`/history`/`/view` itself), Capabilities = only what you
   verified loaded in step 4 (e.g. `image,video` first, add `lipsync,motion` once those
   node checks pass too). On every Vast restart the public port can change — re-paste
   the endpoint the same way the plain `custom` protocol Vast section describes.

This template path is **not auto-registering** (Vast doesn't give you a stable
`NGROK_STATIC_DOMAIN`-style tunnel), so unlike the Kaggle/Colab launcher above, you
register it once by hand and re-paste the URL after a restart — identical trade-off to
the `custom`/Vast.ai flow in `workers/README.md`.
