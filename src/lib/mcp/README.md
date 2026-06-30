# Aurora MCP server

A [Model Context Protocol](https://modelcontextprotocol.io) server exposing
Aurora's generation backend to MCP clients (e.g. Claude). It is wired into the
**real** app: tools call the same `/api/public/generate` endpoint and `jobs`
queue used by the rest of Aurora, so credits, SSRF guards and audit logging all
apply.

## Endpoint

```
POST https://<your-domain>/api/mcp
Authorization: Bearer <Supabase JWT | aurk_ API key>
Content-Type: application/json
```

- Transport: **Streamable HTTP** (stateless JSON-RPC). No SDK dependency — this
  runs on Bun (dev) and Cloudflare Workers (prod).
- `initialize`, `tools/list`, `ping` are open. `tools/call` requires the bearer.

## Tools

All tools are namespaced `aurora_*`. Single items render **synchronously** (the
result URL is returned directly); everything else is **queued** onto `public.jobs`
and tracked with `aurora_get_job_status`.

| Tool | Mode | Credits | What it does |
| --- | --- | --- | --- |
| `aurora_generate_video` | sync | per model | Render a short video; optionally attach a persona via `avatar_name`. Returns the URL. |
| `aurora_image_to_video` | sync | per model | Animate a still image into a 3–12s clip. Returns the URL. |
| `aurora_bulk_generate` | queued | 1 / image | Batch up to 50 persona images, auto-varying location/outfit/mood/lighting. Returns job IDs. |
| `aurora_animate_from_driving_video` | queued | 5 | MimicMotion / pose transfer onto a still. Needs a `motion`-capable GPU worker. |
| `aurora_performance_reskin` | queued | 8 | Reskin a real performance video onto an avatar (+ optional lip-sync). Needs a `motion` worker. |
| `aurora_generate_ugc_ad` | queued | 8 | Talking UGC ad for a persona: script → voice → still → i2v → lip-sync. Returns a job ID. |
| `aurora_generate_campaign` | queued | 6 / set | N matched image+video sets from one prompt template. Returns job IDs. |
| `aurora_get_job_status` | — | 0 | Status + output URL for a queued job or past generation. |
| `aurora_list_avatars` | — | 0 | List the caller's personas. |
| `aurora_create_avatar` | — | 0 | Create a persona (optional HeyGen/Sync LoRA training). |

The motion/reskin tools fail loudly (no credits reserved) when no `motion`-capable
GPU worker is connected. Identity is locked across shots: persona-driven tools
pass the avatar's reference image to the model, never the trigger word alone.

## Auth

Same as `/api/public/generate`:
- A Supabase user JWT, **or**
- A personal `aurk_…` API key (looked up in `api_keys`).

All avatar data is scoped per user. Single-item generations are synchronous;
bulk image generation is enqueued onto `public.jobs` and rendered by the
`/api/public/jobs/tick` worker.

## Optional environment variables

- `HEYGEN_API_KEY` — enables HeyGen custom-avatar (LoRA) training on
  `aurora_create_avatar` when reference images are supplied.
- `SYNC_API_KEY` — enables Sync.so lip-sync model training (`lipsync: true`).

Without these, `aurora_create_avatar` creates a ready-to-use persona record.

## Files

- `server.server.ts` — tool manifest, Zod→JSON-Schema, dispatch.
- `tools.server.ts` — tool implementations (self-call generate / enqueue jobs).
- `avatars.server.ts` — per-user avatar data access + optional training.
- `model-selector.ts` — advisory model/aspect heuristics.
- `types.ts` — shared types.
- `../../routes/api/mcp.ts` — the JSON-RPC HTTP handler.
