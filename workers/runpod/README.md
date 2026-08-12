# RunPod Serverless worker (lipsync + motion)

Runs LatentSync + MimicMotion as a RunPod Serverless endpoint. One endpoint serves
**both** tasks — `kind` is in the job body.

## Deploy via RunPod GitHub builder (no local Docker needed)

RunPod builds the image straight from your GitHub repo, so you never need Docker
installed locally.

1. RunPod → **Serverless** → **New Endpoint** → choose **GitHub Repo** as the
   source (connect your GitHub account the first time).
2. Pick this repository and the branch to build (e.g. `Main`).
3. **Dockerfile path**: `workers/runpod/Dockerfile`. Leave the build context as
   the repo root — the Dockerfile handles that itself.
4. Add a **build argument**: name `HF_TOKEN`, value = a Hugging Face **read**
   token from <https://huggingface.co/settings/tokens>. It lets the build
   download the gated Stable-Video-Diffusion weights that `motion` needs
   (accept the license on the
   [SVD model page](https://huggingface.co/stabilityai/stable-video-diffusion-img2vid-xt-1-1)
   first), so motion jobs need no Hugging Face auth at runtime. The login
   token itself is deleted before the layer commits — it never persists in
   the image filesystem — but build args do appear in the private image's
   build metadata, so use a fine-grained read-only token, never a write token.
   If you skip this arg, the image still builds; motion jobs then
   lazy-download SVD on first use and need `HF_TOKEN` set as an endpoint
   **runtime** env secret.
5. GPU: **24 GB+** (A5000 / 4090 / L40S). Container disk **≥ 50 GB** — the image
   carries ~24 GB of weights and jobs need scratch space.
6. **Deploy**, wait for the build to go green, then copy the **endpoint id**
   from the endpoint page and [register it in Aurora](#register-in-aurora).

The first build downloads all weights (24 GB+), so expect it to take a while;
later builds reuse cached layers unless `setup.sh` or the `HF_TOKEN` build arg
changed.

## Build & push locally (alternative)

```bash
# from the repo root — either context works, same Dockerfile:
docker build -f workers/runpod/Dockerfile --build-arg HF_TOKEN=hf_xxx \
  -t <you>/aurora-worker:latest .          # repo root as context
docker build -f workers/runpod/Dockerfile --build-arg HF_TOKEN=hf_xxx \
  -t <you>/aurora-worker:latest workers    # legacy workers/ context
docker push <you>/aurora-worker:latest
```

> Omit `--build-arg HF_TOKEN=...` for a lipsync-only image — LatentSync's
> weights are public. (A `huggingface-cli login` on your host does **not**
> reach the build container; the build arg is the only way to authorize the
> gated SVD download during a Docker build.)

Then on RunPod: **Serverless** → **New Endpoint** → **Docker Image** → your
image, same GPU/disk sizing as above.

## Runtime env (optional)

Set `AURORA_UPLOAD=supabase` + `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` /
`SUPABASE_BUCKET` on the endpoint for durable result hosting (default is
catbox.moe).

## Register in Aurora

**Admin → Workers → Register GPU worker**

| field        | value                                            |
| ------------ | ------------------------------------------------ |
| Protocol     | `runpod`                                          |
| Endpoint     | `https://api.runpod.ai/v2/<your-endpoint-id>`    |
| Auth token   | your RunPod API key                              |
| Capabilities | `lipsync,motion`                                 |
| RunPod sync  | ON for short jobs (`/runsync`); OFF to poll `/status` |

Test it: pick **LatentSync (self-hosted)** in the Lip-sync page and run a clip.
