# BytePlus film-studio adoption

## What was adopted from the film-studio sessions

Aurora's existing Video Agent remains the product surface. The useful
film-production behavior is incorporated into its cinematic planner:
brief-first intake, screenplay beats, explicit directing choices, shot-level
prompts, a structured continuity ledger, and warnings for contradictions or
missing constraints. The stages are brief, script, continuity, shot list,
render plan, rendering, and assembly/export.

The planner prefers the configured DeepSeek route, but retains compatible
Aurora planning fallbacks. Results disclose the actual serving provider and
model rather than claiming DeepSeek served every request. BytePlus Pro/Flash
model IDs were not guessed from screenshots: account verification failed.

The adopted plan can enter the existing durable Video Agent project flow.
This is not a new filesystem-based agent or a separate video product.
Rendering must retain the project's approval, ownership and concurrency
checks. Revisions are not automatic approvals.

## Native Seedance 2.5 wire contract

The explicit `byteplus/seedance-2.5` renderer maps to
`dreamina-seedance-2-5-260628`. Its request builder preserves all image
references, reference roles, one video and one audio reference, and explicit
audio, watermark, seed, ratio, resolution and duration controls. Aurora
currently bounds this integration to 4–15 seconds and 480p/720p. Unsupported
settings fail rather than being silently clamped after approval.

The explicit native key, and rich multimodal requests using the legacy
`seedance-2.5` key, cannot fall through to generic adapters that discard
references or controls. The native key uses the same canonical Aura tier as
the existing Seedance 2.5 key. Existing subscriber and free-GPU-only checks
still apply; an expiring provider allowance is not permission to bypass them.

Seedream 5.0 Pro already has the supplied model ID in Aurora's image map.
Its image helper supports explicit size and watermark values and requests
a non-streaming URL response.

## What was deliberately skipped

- Unsupported claims that eleven independent subagents are running.
- Filesystem repository creation as a user-facing film workflow.
- Unrelated financial-report and presentation instructions from the sessions.
- Making Dola the default film director without a verified live contract.
- Treating embeddings as image generation or proof of identity continuity.
- Automatic spending to exhaust allowances or unverified claims that API
  calls are free.
- Bypassing approved-input or paid-render permissions via MCP.

## Readiness

### Film Studio rollout gates

The application implementation is staged, not activated for native paid
rendering. `FILM_STUDIO_NATIVE_RENDER_ENABLED` defaults off and is checked at
both enqueue and worker dispatch. A disabled enqueue does not reserve Aura.

Before enabling it:

1. Validate and deploy only the scoped project-privilege migration,
   `20260908110000_harden_video_agent_project_privileges.sql`, following
   `docs/DB_MIGRATIONS.md`. The read-only assertions in
   `scripts/verify-video-agent-project-privileges.sql` must pass. Existing
   browser write grants bypass server approval and provenance checks.
2. Verify a funded, authorized BytePlus credential and the exact native
   Seedance model. Current access failures are recorded below.
3. Verify one approved native render through the real durable dispatch,
   including entitlement, reservation settlement, preserved reference and
   controls, actual model disclosure, and export.

The permissions migration has not been applied. Production has unrelated
pending migrations, so an unrestricted `supabase db push` is not an acceptable
shortcut. No live native paid render has been claimed successful.

New planning output must contain the complete screenplay, continuity ledger,
shots and render plan, or ask an explicit clarification question. Missing
deliverables are not manufactured. Planning falls back within bounded limits,
and adopted source plans carry an owner-bound, expiring server receipt.
Revisions in the cinematic panel are explicitly new-project forks; they do not
silently replace an approved durable project. Unsaved continuity edits block
approval.

Live rich-planning checks exposed an overly strict empty optional-dialogue
constraint, which was corrected. The final correction is covered by focused
tests but was not re-probed after the bounded attempt limit; live planning
success is therefore not claimed.

### Additional model helpers

The server-only adapter is in `src/lib/byteplus-tools.server.ts`. It is not
exposed as an HTTP route and is not wired to the studio UI. A server-side
feature may import it after that feature has its own authentication,
authorization, rate limiting, and product-specific usage limits.

### Dola Responses

`bytePlusDolaResponse({ text })` calls `/api/v3/responses` with
`dola-seed-2-1-turbo-260628`, streaming enabled, and no tools by default. This
is the adopted path for bounded, harmless planning work.

Public repository research is opt-in with
`bytePlusDolaResponse({ text, publicRepo: "owner/repository" })`. That option
enables only `https://mcp.deepwiki.com/mcp`; callers cannot select another MCP
server or approval policy. `require_approval: "never"` is therefore confined
to DeepWiki research on a syntactically validated public GitHub repository. It
must not be generalized to private or paid tools.

The helper consumes and validates Server-Sent Events rather than assuming the
endpoint returns an OpenAI SDK completion object. It returns bounded parsed
events plus assembled output text.

### Skylark multimodal embeddings

`bytePlusSkylarkEmbedding({ text, imageUrl })` calls
`/api/v3/embeddings/multimodal` with
`skylark-embedding-vision-250615` and one input array containing both the text
and public HTTPS image. It validates that the response contains one finite
numeric vector. Private-network, credential-bearing, non-HTTPS, and oversized
image URLs are rejected.

## Verification result

Minimal live checks were attempted against the configured environment without
rendering or uploading media. The configured preferred BytePlus credential
returned HTTP 401 `AuthenticationError`. The fallback ARK credential reached
the provider but returned HTTP 403 `AccountOverdueError`. Consequently:

- The live Responses event schema and optional DeepWiki tool execution remain
  blocked and are not claimed ready for production traffic.
- The joint text-plus-image embedding semantics could not be established
  empirically. The request follows the supplied multimodal contract, but its
  semantic behavior and returned vector shape remain blocked on a funded,
  authorized credential.
- Unit tests cover exact request bodies, bounded SSE parsing, fixed MCP
  configuration, URL/input controls, vector validation, and sanitized errors.

## Adopted versus skipped

Adopted: separate server-only helpers, fixed model IDs and endpoints, tools-off
planning by default, fixed DeepWiki-only public-repository research, bounded
timeouts/input/output, public-image URL checks, and provider-error
sanitization.

Skipped: public API routes, UI wiring, arbitrary MCP endpoints, private/paid
tool access, unbounded provider output, media rendering, and any claim of live
production readiness while credential and account checks are failing.