---
name: Studio bucket result URLs
description: Why job runners must return raw provider URLs for results, not re-persist into the private studio bucket.
---

# Returning generation result URLs

The `studio` Supabase bucket is **private**. `storage.from("studio").getPublicUrl(path)`
returns a `/object/public/studio/...` URL that is **not client-readable** (returns 400).
There is **no read-time signing layer** — whatever URL is written to
`generations.result_image_url` / `result_video_url` is handed to the client / MCP as-is.

**Rule:** job runners (`jobs.server.ts`) must return the **raw provider URL** from
`orchestrate()` (`result.url`) for final image/video results — exactly like
`runRemix`, `runMediaJob`, and `runPerformanceReskin` do. Do **not** re-fetch and
re-upload the result into `studio` and return `getPublicUrl` — that produces a
broken (400) final URL.

**Why:** the orchestrator's Replicate adapter returns the raw, temporarily-public
Replicate delivery URL (it does not persist). Only the HF and Gemini adapters
upload to `studio` + `getPublicUrl`, and those run behind their own access path;
there is no generic re-signing of stored result URLs on read.

**Nuance — refs vs results:** uploading *intermediate* assets (e.g. TTS audio) to
`studio` and passing that `getPublicUrl` as a `GenerateRequest.audioUrl`/`imageUrls`
ref IS fine, because `orchestrate` runs `signStudioRefs`/`signIfStudio` to convert
any `/object/public/studio/...` ref into a short-lived signed URL before the
provider fetches it. Signing only happens on the *request refs*, never on the
returned result URL.

**How to apply:** when adding a new runner that produces a final media result,
return `result.url` directly. Durable long-term storage of results is an app-wide
concern (every runner currently relies on raw provider URLs), not something to
bolt onto a single runner.
