# RunPod Serverless worker (lipsync + motion)

Runs LatentSync + MimicMotion as a RunPod Serverless endpoint. One endpoint serves
**both** tasks — `kind` is in the job body.

## Build & push

```bash
# from the repo root — build context is the workers/ dir
docker build -f workers/runpod/Dockerfile -t <you>/aurora-worker:latest workers
docker push <you>/aurora-worker:latest
```

> The image clones LatentSync + MimicMotion and downloads their weights at build time
> (24 GB+). The Stable-Video-Diffusion base model is gated — run
> `huggingface-cli login` and accept the license, or bake `HF_TOKEN` in as a build arg.

## Deploy

1. RunPod → **Serverless** → **New Endpoint** → your image.
2. GPU: 24 GB+ (A5000 / 4090 / L40S). Container disk ≥ 40 GB.
3. (Optional) set `AURORA_UPLOAD=supabase` + `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
   / `SUPABASE_BUCKET` env vars for durable result hosting (default is catbox.moe).

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
