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

## Known intentional exclusions

- UGC `remixImageUrl` / TikTok-remix `sourceImageUrl` are driving-video-like inputs, not character references — deliberately unguarded, but worth a future review.
- Base64 image data is transient-only (never stored as a URL) so it is not guarded.
- Any new endpoint that takes a "characterImageUrl"-style field must add the guard at introduction time; grep for `assertOwnedReferenceImage` call sites to see current coverage rather than trusting a list here.
- Admin-only smoke chains must not bypass the guard: stage the external reference into the smoke user's own studio folder first, then pass it through the same shared enqueue path as a real user.
