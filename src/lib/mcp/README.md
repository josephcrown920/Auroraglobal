# Aurora MCP server

A [Model Context Protocol](https://modelcontextprotocol.io) server exposing
Aurora's generation backend to MCP clients (Claude, Cursor, etc.). It is wired
into the **real** app: tools call the same `/api/public/generate` endpoint and
`jobs` queue used by the rest of Aurora, so credits, SSRF guards and audit
logging all apply.

## Endpoint

```
POST https://<your-domain>/api/mcp
Authorization: Bearer <Supabase JWT | aurk_ API key>
Content-Type: application/json
```

- Transport: **Streamable HTTP** (stateless JSON-RPC). No SDK dependency — this
  runs on Bun (dev) and Cloudflare Workers (prod).
- `initialize`, `tools/list`, `ping` are open. `tools/call` requires the bearer.

## Getting an API key

Create a personal `aurk_…` key in the app: **Dashboard → API keys** (or the
`/connect` page). The plaintext key is shown once; only its SHA-256 hash is
stored (`api_keys` table). Revoke keys from the same panel.

## Connecting a client

> **claude.ai (web):** custom connectors on claude.ai require an OAuth flow,
> which Aurora doesn't implement yet — use Claude Desktop or Cursor with an
> API key instead.

### Claude Desktop / any stdio-only client

Claude Desktop speaks stdio, so bridge to the HTTP endpoint with
[`mcp-remote`](https://www.npmjs.com/package/mcp-remote) in
`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "aurora": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://<your-domain>/api/mcp",
        "--header", "Authorization: Bearer ${AURORA_API_KEY}"
      ],
      "env": { "AURORA_API_KEY": "aurk_..." }
    }
  }
}
```

### Cursor

Cursor supports streamable-HTTP servers directly in `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "aurora": {
      "url": "https://<your-domain>/api/mcp",
      "headers": { "Authorization": "Bearer aurk_..." }
    }
  }
}
```

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
| `aurora_submit_job` | queued | 1–5 (½ for previews) | Queue one image/video/lipsync/upscale job — the same queue the in-app editor and CLI use. |
| `aurora_list_jobs` | — | 0 | Recent jobs (last 50), optionally filtered by status. |
| `aurora_cancel_job` | — | 0 (refunds) | Cancel a still-`queued` job and release its reserved Aura. |
| `aurora_get_job_status` | — | 0 | Status + output URL for a queued job or past generation. |
| `aurora_list_avatars` | — | 0 | List the caller's personas. |
| `aurora_create_avatar` | — | 0 | Create a persona (optional HeyGen/Sync LoRA training). |

The motion/reskin tools fail loudly (no credits reserved) when no `motion`-capable
GPU worker is connected. Identity is locked across shots: persona-driven tools
pass the avatar's reference image to the model, never the trigger word alone.

`aurora_submit_job` shares its enqueue core (`enqueueJobForUser` in
`src/lib/jobs.functions.ts`) with the in-app editor, so billing rules are
identical: video/lipsync jobs run as cheap **480p/≤5s previews at half price**
unless `confirm_preview_id` references a succeeded preview generation you own,
and 1080p/2160p output requires a Pro plan.

## Auth

Same as `/api/public/generate`:
- A Supabase user JWT, **or**
- A personal `aurk_…` API key (looked up in `api_keys`).

All avatar and job data is scoped per user. Single-item generations are
synchronous; queued jobs are rendered by the `/api/public/jobs/tick` worker.

## Verification (repeatable)

Run against a live instance (dev: `localhost:8080`; note `$REPLIT_DEV_DOMAIN`
returns 0 bytes through the mTLS proxy — always curl localhost). Unit coverage
lives in `server.server.test.ts` / `tools.server.test.ts` (`bun test src/lib/mcp`).

```bash
BASE=http://localhost:8080/api/mcp
KEY=aurk_...   # Dashboard → API keys

# 1. Handshake (open — no auth)
curl -s -X POST $BASE -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"verify","version":"1"}}}'
# → result.serverInfo.name == "aurora-mcp"

# 2. Manifest (open) — expect 13 aurora_* tools
curl -s -X POST $BASE -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 3. Auth gate — tools/call WITHOUT a bearer must fail with -32001
curl -s -X POST $BASE -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"aurora_list_jobs","arguments":{}}}'

# 4. Authenticated read-only call (reserves nothing)
curl -s -X POST $BASE -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $KEY" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"aurora_list_jobs","arguments":{"limit":3}}}'

# 5. (Optional, net-zero credits) submit an image job, then cancel it —
#    cancel releases the 10-Aura reservation.
curl -s -X POST $BASE -H 'Content-Type: application/json' -H "Authorization: Bearer $KEY" \
  -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"aurora_submit_job","arguments":{"kind":"image","prompt":"verification still"}}}'
curl -s -X POST $BASE -H 'Content-Type: application/json' -H "Authorization: Bearer $KEY" \
  -d '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"aurora_cancel_job","arguments":{"job_id":"<job_id from step 5>"}}}'
```

Last verified: 2026-07-02 (all five steps green against dev).

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
- `../jobs.functions.ts` — shared job-queue core (`enqueueJobForUser`, `listJobsForUser`, `cancelJobForUser`).
- `../../routes/api/mcp.ts` — the JSON-RPC HTTP handler.
