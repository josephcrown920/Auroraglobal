---
name: Mobile reference upload
description: How the Expo app must upload reference photos (no HTTP upload API) and why generate-API field names must be verified against the server schema.
---

# Mobile reference-image upload

**Rule:** Aurora has NO custom HTTP upload endpoint. The only upload path (web and mobile alike) is a direct supabase-js Storage upload into the private `studio` bucket at `<userId>/uploads/<id>.<ext>`, followed by `createSignedUrl(path, 3600)`; the signed URL goes into the generation request as `imageUrls: [url]` (camelCase array — the ONLY reference field `/api/public/generate` accepts).

**Why:** The generate endpoint's zod schema is non-passthrough, so unknown body fields are stripped *silently* — the mobile app shipped for a while sending `reference_image_url` (and a local `file://` URI at that) and nothing errored; references were just dead. Field-name drift between a client and the server schema produces zero signal.

**How to apply:**
- When adding any client param for an Aurora API route, read the route's zod schema first and unit-test the built request body against the exact field name.
- RN/Hermes upload recipe (no expo-file-system, no Buffer, `atob` not guaranteed): launch expo-image-picker with `base64: true`, decode with the manual base64 helper in `artifacts/aurora-mobile/lib/reference-image.ts`, then `storage.from("studio").upload(path, bytes.buffer, { contentType })`. Passing an ArrayBuffer is the documented supabase+Expo pattern; Blob-from-file paths are unreliable in RN.
- Storage RLS scopes inserts to the caller's own top-level folder (verified live: foreign-folder upload → "new row violates row-level security policy"), so the `<userId>/uploads/` key shape is a contract, not a convention.
- Signed URLs live 1 hour (web parity). A composer left open longer generates with a dead reference URL — provider-side fetch failure, not a validation error.
- Live-proof pattern without a device: bun script + service-role `auth.admin.createUser` (email_confirm true) + publishable-key `signInWithPassword`, exercise the same pure helpers, then delete object + user.
