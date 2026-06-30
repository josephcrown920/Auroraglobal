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

**Client reality — Bearer-token only:** the connector works with MCP clients that send `Authorization: Bearer <aurk_ key | Supabase JWT>` (Claude Desktop, Cursor). **claude.ai web custom connectors are NOT supported** — they require an OAuth authorization-server flow that this endpoint does not implement. Any UI/doc copy promising claude.ai "one-click consent / no key" is wrong; don't reintroduce it.

**Bearer self-call must target a trusted host:** tools forward the caller's bearer when self-POSTing `/api/public/generate`. Derive that origin from `process.env.SITE_URL` first (request origin only as dev fallback) so the secret can't be exfiltrated by a spoofed Host header.

**Credit-contract invariants (pinned by unit tests, keep them true):** all preconditions — avatar-not-found, missing/untrusted reference image (`assertTrustedUrl`), and `hasActiveWorkerForKind("motion")` false for motion/reskin — must return an error **before** any reservation or `callGenerate`. Sync tools (`generate_video`/`image_to_video`) bill via exactly one `callGenerate` (no RPC); queued tools reserve via `create_generation_and_reserve` with a fixed `_kind`/`_amount` (image=1, motion=5, performance_reskin=8, ugc_ad=`COST_UGC_AD`, ugc_campaign_item=`COST_CAMPAIGN_ITEM`); `list_avatars`/`get_job_status`/`create_avatar` reserve nothing; insufficient balance surfaces as the literal string "Not enough Aura".

**Testability seam:** tools take an injected `ToolDeps` (default `defaultToolDeps`); the protocol layer is `handleRpcMessage(msg, auth, origin, deps)` + `PROTOCOL_VERSION`/`SERVER_INFO`, and the HTTP route is a thin shell over it. Unit-test by injecting fakes — never `mock.module` (process-global, leaks across suites). Registered validation step: `mcp-tests` = `bun test src/lib/mcp`.
