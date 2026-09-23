# Free AI model routing

Aurora now exposes a small, verified free-model catalog through `/api/ai-gateway/models` and a generic streaming endpoint at `/api/ai-gateway/free-chat`.

## Verified free routes

| Capability | Model | Provider |
|---|---|---|
| Reasoning / coding | `poolside/laguna-s-2.1-free` | Vercel AI Gateway |
| Chat | `inclusionai/ling-3.0-flash-fin-free` | Vercel AI Gateway |
| Chat | `inclusionai/ling-3.0-flash-sante-free` | Vercel AI Gateway |
| Vision | `inclusionai/ling-3.0-flash-vl-free` | Vercel AI Gateway |
| Vision / video understanding fallback | `openrouter/free` | OpenRouter |

`AI_GATEWAY_API_KEY` is required for the Vercel AI Gateway routes. No provider secret is committed.

## Image generation

`prodia/flux-fast-schnell` is also wired at `/api/ai-gateway/flux-schnell` because it is extremely inexpensive, but it is **not free**. Current Vercel AI Gateway listing: $0.001/image.

## Video

A free video-output/generation model was **not** verified in the current Vercel AI Gateway or OpenRouter catalogs during this integration. Free multimodal models can understand video, but that is different from generating a video. Aurora's existing Seedance/ModelArk and other video-generation adapters remain the generation path.

This distinction is intentional so the UI never labels a paid video generator as "free".
