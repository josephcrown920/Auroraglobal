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
In this app those are the Google-Gemini image features (default photo style, Split Reality, Visual
Edit) and they bypass the provider orchestrator entirely — they need a Lovable key OR a direct
`GEMINI_API_KEY` to run independent. Also note: the studio image flow only routes NON-Lovable
models through the orchestrator, so the default model must be a Replicate one for "generate" to work
without a Lovable key.

**Gotchas:**
- Replicate `Prefer: wait` long-poll is killed by Cloudflare with a 502 after ~30-60s from this
  environment. Use create + poll (short requests) instead — which is what the app code does.
- A valid `r8_…` token can still 402 ("insufficient credit") — key validity ≠ funded account.
- The `code_execution` sandbox has no `process.env` and no `python3`; validate secret-using calls
  from the bash shell with `node` for parsing. Secrets ARE present in the bash shell env.

**Why:** The whole point of the project was to drop the Lovable dependency; leaving the gateway in
place silently breaks all AI generation when only the provider key is present.
