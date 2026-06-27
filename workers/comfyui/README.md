# ComfyUI worker (lipsync + motion)

For the `comfyui` protocol Aurora **sends the prompt graph itself** — it ships the
LatentSync graph for lip-sync and the MimicMotion graph for motion (see
`src/lib/lipsync-workflows.server.ts` and `src/lib/motion-workflows.server.ts`), then
patches per-node inputs (the input URLs, steps, seed, etc.). You just run stock ComfyUI
with the right custom nodes installed.

The JSON files here are **reference exports** of those default graphs (API format) so
you can import them into the ComfyUI editor, confirm the node class names match your
install, and adjust if your custom nodes use different names.

| file                              | task    | key custom nodes                          |
| --------------------------------- | ------- | ----------------------------------------- |
| `latentsync-lipsync.workflow.json`| lipsync | `LoadVideoFromUrl`, `LoadAudioFromUrl`, `LatentSyncSampler`, `VideoCombine`, `SaveVideo` |
| `mimicmotion-motion.workflow.json`| motion  | `LoadImageFromUrl`, `LoadVideoFromUrl`, `MimicMotionSampler`, `VideoCombine`, `SaveVideo` |

## Setup

1. Install [ComfyUI](https://github.com/comfyanonymous/ComfyUI).
2. Install the custom nodes that provide the classes above, e.g.:
   - a LatentSync ComfyUI wrapper node pack (provides `LatentSyncSampler`),
   - a MimicMotion ComfyUI wrapper node pack (provides `MimicMotionSampler`),
   - URL loader + `VideoHelperSuite` for `Load*FromUrl` / `VideoCombine`.
3. Download the LatentSync + MimicMotion weights into the node packs' `models` dirs.
4. Start ComfyUI listening on all interfaces:
   ```bash
   python main.py --listen 0.0.0.0 --port 8188
   ```

> **Node names must match.** Aurora patches inputs by `nodeId.inputName` against the
> graphs above. If your custom nodes expose different class/input names, either rename
> them or edit the default graphs in the two `*-workflows.server.ts` files.

## Register in Aurora

**Admin → Workers → Register GPU worker**

| field        | value                       |
| ------------ | --------------------------- |
| Protocol     | `comfyui`                    |
| Endpoint     | `https://<host>:8188`        |
| Auth token   | only if you put ComfyUI behind an auth proxy |
| Capabilities | `lipsync,motion`            |
