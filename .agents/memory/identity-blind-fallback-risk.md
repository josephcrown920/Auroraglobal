---
name: Identity-blind image fallback risk
description: Non-strict image generation (e.g. multi-angle reshoot) can silently fall through to an identity-blind provider when all identity-capable providers fail.
---

Aurora's image generation orchestrator (`src/lib/orchestrator.server.ts`) has a documented, deliberate fallback chain (`FALLBACK_MODELS.image`) that ends at Pollinations — a free, identity-blind text-to-image provider used as a "faceless last resort." This exists across the whole image-generation system, not just one feature.

For identity-locked flows (e.g. the Canvas "multi-angle photo reshoot," which is supposed to produce 6 distinct angles of the SAME person), this means: if every identity-capable provider (Gemini direct, Fal edit endpoints, Replicate nano-banana, etc.) is down/quota-exhausted/out of balance at the same time, the request still "succeeds" — but the resulting image can show a completely different-looking person, with no error and no visible warning to the user.

**Why:** Verified live — a real reshoot request failed on Gemini direct (429 quota exceeded) and Fal (403 balance exhausted), both real external account issues, and fell all the way to Pollinations. The code path itself is not a bug; the risk is that a false "identity preserved" success is indistinguishable from a real one at the UI layer.

**How to apply:** When verifying an identity-locked generation actually worked (not just "did it return 200"), check which provider actually won — via server logs / `provider_logs` / the result's model metadata — rather than trusting the orchestrator's return value alone. The durable fix is to surface identity-capable vs. identity-blind provider status to the UI/user instead of silently succeeding with a mismatched face.
