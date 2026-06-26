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

| Tool | What it does |
| --- | --- |
| `aurora_generate_video` | Render a short video synchronously; returns the URL. |
| `aurora_image_to_video` | Animate a still image; returns the URL. |
| `aurora_bulk_generate` | Queue up to 50 images for a persona; returns job IDs. |
| `aurora_get_job_status` | Status + output URL for a queued job / past generation. |
| `aurora_list_avatars` | List the caller's personas. |
| `aurora_create_avatar` | Create a persona (optional HeyGen/Sync LoRA training). |

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
