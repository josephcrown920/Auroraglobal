---
name: Aurora MCP server
description: How the Model Context Protocol server is wired into this app and the constraints that shaped it
---

The MCP server is a **hand-rolled stateless JSON-RPC handler** (Streamable HTTP) at `POST /api/mcp`, NOT built on `@modelcontextprotocol/sdk`.

**Why:** the SDK's transports (stdio / SSE) are Node-only, but prod runs on Cloudflare Workers. A plain JSON-RPC POST handler is Workers-safe and needs **zero new dependencies**. It handles `initialize`, `notifications/initialized` (202), `ping`, `tools/list`, `tools/call`. Discovery is open; `tools/call` requires a Bearer token (Supabase JWT or `aurk_` key — same auth as `/api/public/generate`).

**How to apply when extending tools:**
- Single-item generation must **self-POST `/api/public/generate`** with the caller's bearer — that endpoint owns credit reservation, SSRF guarding (`assertTrustedUrl`) and audit. Do NOT call `orchestrate()` directly from a tool; it bypasses credits/audit.
- Bulk generation must **enqueue via the `create_generation_and_reserve` RPC** (atomic reserve + `generations` row + `jobs` row), then the `/api/public/jobs/tick` worker renders them. `/api/public/generate` is synchronous (returns `{ok,url,provider}`), so single items return URLs directly — there is no job_id for them.

**Avatars gotcha:** the per-user `public.avatars` table exists in the LIVE DB (RLS `auth.uid()=user_id`, trigger `touch_updated_at`), but `src/integrations/supabase/types.ts` is NOT regenerated, so avatar DB access casts `supabaseAdmin` to a loose client. If you regenerate types, drop the cast. Avatar LoRA training (HeyGen/Sync) only fires when `HEYGEN_API_KEY`/`SYNC_API_KEY` are set; otherwise a plain ready-to-use record is created.
