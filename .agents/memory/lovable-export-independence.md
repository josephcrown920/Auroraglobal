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
