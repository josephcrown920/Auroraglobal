---
name: Replit-first provider routing (strict model-key gating)
description: How the orchestrator makes Replit AI Integrations first-choice for image/text/audio without hijacking pinned requests or truncating fallback chains.
---

When adding a "billed to Replit credits" adapter that should be the first hop for a modality but must never override an explicit user/pinned model choice, gate `supports()` on an EXACT model-key match against a small `Record<modelKey, {adapter, model, cost}>` map — not just on "env vars present + kind matches". `getCandidateModels()` always seeds an unpinned request's candidate #1 from `FALLBACK_MODELS[kind][0]`, so putting the Replit model key first in that list is what actually makes unpinned requests route to Replit; the adapter's own `supports()` gate is what stops a request pinned to a *different* provider's model (e.g. `google/gemini-2.5-flash-image`) from being hijacked.

**Why:** a looser gate (e.g. "supports any image request when env vars exist") would silently reroute every pinned non-Replit request through Replit too, breaking explicit model choices and any per-model behavior downstream (e.g. reference-image support).

**How to apply:**
- Every new model key added ahead of the existing chain must also bump that kind's `FALLBACK_CAP` by the same count, or the cap silently truncates the *last* candidate off the unpinned list (verified via a "cap >= fallback list length" regression test in `orchestrator.modalities.test.ts`).
- An adapter that structurally can't serve some request shapes (e.g. OpenAI `images.generate` has no reference-image input) must gate that in `supports()` too (`!r.imageUrls?.length`) so it cleanly falls through rather than silently dropping the reference.
- Client SDKs used only for a first-choice/proxy hop should have their own `maxRetries`/timeout disabled or capped — the orchestrator already wraps every adapter in its own retry + circuit-breaker, so an SDK-level retry loop on top multiplies billed attempts on a persistently failing call.
