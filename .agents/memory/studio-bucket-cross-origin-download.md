---
name: Studio bucket cross-origin download
description: Why a plain <a download href={publicStudioUrl}> silently fails to save files, and the fix.
---

The `studio` Supabase storage bucket is public (`storage.buckets.public = true`), so generated
media (TTS audio, images, video) is served from a public bucket URL — but that URL is
cross-origin relative to the app. Browsers ignore the `download` attribute on `<a>` tags for
cross-origin resources; clicking such a link just navigates to/opens the file instead of saving it.

**Why:** confirmed by testing — an `<a href={crossOriginUrl} download>` opened the MP3 in a new
tab rather than triggering a save dialog.

**How to apply:** for a reliable "Download" affordance on any studio-bucket result, fetch the
bytes client-side, build a `Blob`, create an `URL.createObjectURL(blob)`, and click a
same-origin blob-URL anchor with `download="name.ext"` set. This works regardless of the
resource's origin. Same-page `<audio>`/`<video>` playback via `src={url}` is unaffected — only
save-to-disk is impacted.
