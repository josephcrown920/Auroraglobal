---
name: Directors Board integration
description: How the directors-board zip was ported — AI SDK v6 tool/chat API quirks, asset stripping, streaming image protocol
---

## Rule
When porting Lovable storyboard/canvas features, strip asset.json imports (they point to `/__l5e/assets-v1/...` CDN that only works in Lovable) — seed boards with `imageUrl: null` so users generate their own frames.

**Why:** Lovable asset URLs are project-scoped CDN paths that 404 outside the Lovable sandbox.

**How to apply:** Replace every `import shot from "@/assets/storyboard/*.asset.json"` with `null`; keep the shot metadata (title, frame, wardrobe, mood, note).

---

## Rule
AI SDK v6 (`ai ^6`): `tool()` uses `inputSchema` not `parameters`; `CoreMessage` is not exported from `ai` — use `ModelMessage` from `@ai-sdk/provider-utils` or `convertToModelMessages` + `UIMessage`; `toUIMessageStreamResponse` takes no `originalMessages` arg in v6; `execute: undefined` on a streamText tool means client-side-only (no server execution).

**Why:** API changed between v3/v4 and v6 — Lovable zip code uses the old parameter names.

**How to apply:** When porting chat/tool endpoints: `inputSchema` not `parameters`, `execute: undefined` for client-rendered tools, `await convertToModelMessages(uiMessages)` for message conversion.

---

## Rule
`streamImage.ts` dual-mode: when image gen endpoints return `application/json { url }` instead of SSE base64, detect via `content-type` and call `onFrame(url, true)` directly — no parser needed.

**Why:** Aurora's `orchestrate()` returns a URL, not a b64 SSE stream; adapting the client is cheaper than wrapping every result in SSE.

**How to apply:** Check `res.headers.get("content-type")?.includes("application/json")` at the top of the SSE read loop; return early with `onFrame(json.url, true)`.

---

## Rule
`render_jobs` table (Directors Board GPU fleet): `board_id TEXT`, `shot_id TEXT`, `model TEXT`, `prompt TEXT`, `status TEXT CHECK (queued|running|completed|failed)`, `output_url TEXT`, `worker_id UUID`. GPU routes: `/api/public/gpu/{register,claim,complete}` — workers poll `/claim` and post back to `/complete`. Migration `20260808160000` is live.

**Why:** Needed for the Directors Board VideoAgentPanel to queue and poll video renders on self-hosted GPUs.
