---
name: Reference-image ownership guard
description: How Aurora verifies a user-supplied "character"/reference image URL is actually owned by the caller before it's used in a render.
---

`assertOwnedReferenceImage(url, userId)` in `src/lib/url-guard.ts` is the shared guard for any endpoint that accepts a user-supplied character/persona reference image URL (as opposed to a driving video or other non-identity input).

It accepts:
- the caller's own studio-bucket upload/result (reuses `assertOwnStudioUpload`'s `studio/<userId>/...` path check)
- a saved avatar the caller owns (`avatars.preview_url` scoped to `user_id`, via a loosely-typed handle since `avatars` isn't in generated Supabase types yet — same pattern as `avatars.server.ts`)

It rejects everything else (foreign studio objects, arbitrary URLs), running the existing SSRF host-allowlist check first.

**Why:** a crafted request could otherwise point a render's character reference at someone else's private studio asset — defense-in-depth, not a proven exploit.

**How to apply:** call it (async) right after zod validation, before any credit reservation, for every new endpoint that takes a "character image" URL.

## Coverage status (as of Task #408)

Now covered:
- Kids Story, motion transfer imageUrl, performance reskin avatarImageUrl — existing (pre-Task #408)
- **UGC** (`generateSceneImagesFromRef` — `referenceUrl` field; note: base64 image data is transient-only, never stored as a URL so not guarded) — `src/lib/ugc-line.functions.ts`
- **Performance Shot** (`generatePerformanceShot` — loops all `imageUrls`) — `src/lib/studio.functions.ts`
- **Agent** (`runAuroraAgent` — `referenceImages[]`; `refineAuroraPlan` — `referenceImages[]`; also now requires auth) — `src/lib/agent.functions.ts`
- **MCP tools** (`imageToVideoTool`, `animateFromDrivingVideoTool`, `performanceReskinTool`, `submitJobTool`) via injected `ToolDeps.assertOwnedRef` — `src/lib/mcp/tools.server.ts`

Still open gaps:
- UGC `remixImageUrl` / TikTok-remix `sourceImageUrl` (driving-video-like inputs, not character references — intentional exclusion, but worth a future review)
- Any new endpoint added that takes a "characterImageUrl" or similar field — the guard must be added at that time
