---
name: Photo editor editStrict routing
description: How strict photo-edit requests are kept on edit-capable models only, and the URL ownership guard for user-supplied studio photos.
---

# Photo editor editStrict

**Rule:** a request whose imageUrls are an EDIT SOURCE (not a loose reference) must set
`editStrict` on GenerateRequest. That filters candidate models to the edit-capable set
(derived from the fal identity-edit map + gemini direct slug map, so newly mapped models
qualify automatically) and drops the GPU worker adapter (its image capability is
identity-blind ComfyUI text-to-image).

**Why:** the normal image fallback chain ends in t2i models (seedream/flux/pollinations)
that silently return an unrelated generated image instead of an edit — the user would be
charged for a non-edit. Explicit failure beats a silent non-edit. nano-banana's
"anchor to input, light changes" behaviour (wrong for batch generation) is exactly right
for editing, which is why the photo editor pins it deliberately.

**How to apply:** any new edit-style surface should reuse `editStrict` +
`reserveOrchestrateRecord` (which forwards it) rather than inventing a parallel path.
User-supplied photo URLs must pass the own-studio-folder guard in url-guard
(`assertOwnStudioUpload`): SSRF allowlist first, then studio-bucket path whose first
segment equals the caller's uid. Note the WHATWG URL parser normalizes `..` AND `%2e%2e`
segments before any check runs — traversal attempts land outside the caller's folder and
fail ownership; tests asserting a specific error message for those cases will be wrong.
