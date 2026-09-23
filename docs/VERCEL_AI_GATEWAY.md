# Vercel AI Gateway

Aurora can call Poolside Laguna S 2.1 Free through Vercel AI Gateway.

## Secret

Set this as a **server-side** environment variable in Vercel:

`AI_GATEWAY_API_KEY`

Do not commit the value to GitHub and do not use a `VITE_` prefix.

## Model

`poolside/laguna-s-2.1-free`

The model is text-only and intended for agentic coding/technical tasks. Vercel currently lists a 256K-token context window for the free variant.

## API route

Aurora exposes:

`POST /api/ai-gateway/laguna`

Request body:

```json
{
  "prompt": "Inspect the Aurora architecture and propose the next safe fix.",
  "system": "You are a senior coding agent."
}
```

The endpoint streams the model response and returns `503` when `AI_GATEWAY_API_KEY` is not configured.

## Vercel setup

Create a Gateway key with the Vercel CLI:

```bash
vercel ai-gateway api-keys create --name aurora-gateway
```

Then add the printed value to the Vercel project's Production/Preview/Development environments as `AI_GATEWAY_API_KEY`, and redeploy.
