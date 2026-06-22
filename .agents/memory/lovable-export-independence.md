---
name: Lovable export → run independent
description: How a Lovable-exported app hides third-party providers behind Lovable's gateway, and how to cut the dependency.
---

# Making a Lovable-exported app independent of Lovable

**Pattern:** Lovable exports route third-party AI providers through Lovable's connector gateway
(`connector-gateway.lovable.dev/<provider>/v1`) and require a `LOVABLE_API_KEY` (Bearer) plus the
provider key sent as `X-Connection-Api-Key`. The gateway swaps the connection key for the real
provider token. So even with the real provider key set, every call fails without a Lovable key.

**To run independent:** rewrite the provider client to call the provider's own API directly
(Replicate → `https://api.replicate.com/v1`, `Authorization: Bearer <REPLICATE_API_KEY>`).
The prediction paths (`POST /models/{owner}/{name}/predictions`, `GET /predictions/{id}`) are
identical on the real Replicate API, so only the base URL + auth header change.

**Also check** for features hardcoded to `ai.gateway.lovable.dev` with a `Lovable-API-Key` header.
In this app those WERE the Google-Gemini image features (default photo style, Split Reality, Visual
Edit) — they used to bypass the orchestrator and call the Lovable gateway directly. They have since
been rewritten to route ALL image generation through `orchestrate({kind:"image"})`, and the studio
default image model is a Replicate one (`google/nano-banana`), so "generate" works on the Replicate
key alone. A Gemini/Lovable key is now optional (used first only if the user picks a Gemini model).

**Model + provider fallback design (orchestrator.server.ts):** two layers. (1) PROVIDER chain per
model (gemini→hf→replicate→lovable→gpu→fal, gated by `supports()`); (2) MODEL candidates —
`getCandidateModels()` = [requested, ...FALLBACK_MODELS[kind]] deduped + capped (image 3, video 2,
lipsync 2). `orchestrate()` outer-loops candidate models, inner-loops the provider chain, first
success wins.
- **Gotcha (cost a rev to find):** most candidate models share ONE provider (Replicate). The health
  circuit-breaker (`markFailure`→cooldown→`isHealthy`) will skip that shared provider for the rest of
  the SAME request after the first model fails, silently defeating model fallback. Fix: snapshot
  `isHealthy` ONCE at the top of `orchestrate()` and filter candidates against that snapshot; and
  only `markFailure` on real provider-down signals (5xx/429/402/timeout), not model-input errors.
- Keep `FATAL_RE` (abort-early) to REQUEST-level problems only (unsafe/invalid URL, "not your"). Do
  NOT put provider auth (401/403) there — a bad Gemini/Lovable key must fall THROUGH to Replicate.
- **Per-model Replicate input schemas differ** — build inputs per-model (a `build(r)` fn per entry),
  never a shared shape. Verify each with `GET https://api.replicate.com/v1/models/{owner}/{name}`:
  seedance=image+integer duration; kling=start_image+enum duration; wan-i2v=image+enum duration;
  veo/sora omit duration (image/input_reference optional); nano-banana/seedream=image_input[] array.

**Gotchas:**
- Replicate `Prefer: wait` long-poll is killed by Cloudflare with a 502 after ~30-60s from this
  environment. Use create + poll (short requests) instead — which is what the app code does.
- A valid `r8_…` token can still 402 ("insufficient credit") — key validity ≠ funded account. A
  402 (not 401/422) on a smoke test confirms the key+input are valid and only billing is missing.
- **No free video.** WAN / Veo / Sora / Kling / Seedance all cost real Replicate credit. Only
  Gemini free-tier, HuggingFace, or Lovable-credit image paths are cheap/free. Tell the user this.
- The `code_execution` sandbox has no `process.env` and no `python3`; validate secret-using calls
  from the bash shell with `node` for parsing. Secrets ARE present in the bash shell env.

**Why:** The whole point of the project was to drop the Lovable dependency; leaving the gateway in
place silently breaks all AI generation when only the provider key is present.

## Missing images/videos: the `*.asset.json` / `__l5e` trap

**Symptom:** A Lovable-exported app renders as an "empty UI skeleton" — text and layout but no
photos/videos. The exported repo ships `*.asset.json` manifest files (e.g.
`josh-blue-orange.jpg.asset.json`) imported in components and consumed as `src={img.url}`. Their
`url` field is a root-relative path `/__l5e/assets-v1/<asset_id>/<file>` that is ONLY served by
Lovable's dev plugin/CDN. On a plain Vite/TanStack host those paths 404, so every manifest-backed
image/video is broken. Hardcoded `/__l5e/...` strings (videos in landing components) and full
`https://<project>.lovable.app/__l5e/...` URLs (server-side smoke tests) have the same root.

**Fix that needs ZERO code changes:** the Lovable preview stays live at
`https://<project>.lovable.app` — verify with curl (assets return 200). Mirror every referenced
asset into `public/__l5e/assets-v1/<id>/<file>` so the existing `.url` paths resolve locally. Vite
serves `public/` at root (dev) and copies it into the build output (`dist/client` here), so it works
in prod too. **You must restart the dev server** after adding files — Vite snapshots the public dir
at startup and otherwise keeps 404ing new files (robots.txt served but new files didn't, until
restart).

**Discovery gotcha:** collect URLs from two sources — (a) parse each `*.asset.json`'s `url` field
(clean paths), and (b) grep source for hardcoded `/__l5e/...`. Use `rg -o --no-filename`; without
`--no-filename`, rg prefixes matches with `path:` producing malformed "URLs" that fail and look like
missing assets when they are really just dupes of the clean set.

**Download gotcha:** the Lovable CDN drops connections ("fetch failed", NOT 404) under load — high
concurrency + large videos throttles it after ~70 files. Use low concurrency (≤3), inter-request
delay, retries with backoff, and make the script idempotent (skip existing size>0 files) so re-runs
only retry the remainder.

**Verifying render:** the external/headless screenshot service shows a false broken-image icon on a
stacked opacity-transition slideshow (captures mid-load). Don't trust it alone — confirm with: all
assets return 200 + `image/*` content-type via the dev domain, `file --mime-type` on disk shows only
real media (no HTML error pages saved), and a STATIC image-grid page (e.g. a UGC avatar grid)
renders cleanly.

## Real video/lipsync provider = Replicate (NOT fal) + per-clip cost

The video models advertise `fal-ai/...` endpoint strings in `models.ts`, but the orchestrator's
`REPLICATE_MAP` keys off the model VALUE and runs them on **Replicate** slugs. With only
`REPLICATE_API_KEY` set (no `FAL_KEY`/`KLING_*`), the video chain `[klingDirect, replicate, …]` lands
on the `replicate` adapter. So ONE Replicate key powers image + video + lipsync. Price with
Replicate's rates, not fal's.
- `seedance-2.0` → `bytedance/seedance-1-pro` ≈ **$0.12–0.15/sec** (~$0.60–0.75 per 5s clip).
- `seedance-2.0-fast` → `bytedance/seedance-1-lite` ≈ **~$0.01/sec** (~$0.05 per 5s clip) — ~13× cheaper.
- `kling-3.0/omni` → `kwaivgi/kling-v2.1[-master]`; only Kling builds pass `end_image` (true
  start+end-frame "motion control" is Kling-only — Seedance just animates the first frame).
- image `google/nano-banana` ≈ $0.04; lipsync `sync/sync-1.6.0` billed by GPU time (~$0.1–0.3/short clip).
**Why:** an earlier cost estimate in this project quoted fal's Seedance prices (~$0.18/720p), which is
wrong for this app — it bills Replicate. For cheap testing/default, prefer `seedance-2.0-fast`.
