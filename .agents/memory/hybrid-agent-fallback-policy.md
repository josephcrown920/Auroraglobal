---
name: Hybrid agent fallback policy
description: User-approved separation of brain and render fallback, with transparent automatic recovery.
---

Aurora's default hybrid mode should automatically try compatible backups for both agent brains (chat, scripts, planning) and rendering. “No silent fallback” means disclose the actual serving engine, not require manual intervention for every provider failure. Retain Seedream and Seedance as choices; Google-only is an optional constrained mode.

**Why:** The user explicitly clarified that fallback is wanted for the agent's brain as well as media generation, after screenshots showed retired models stopping planning.

**How to apply:** Preserve context and validated output contracts across bounded brain retries. Media backups must support the same reference inputs, identity and motion requirements; ordinary text-to-video is not a substitute for performance transfer. Never exceed approved cost or change the engine behind an approved final without a replacement preview approval. Authentication errors require sign-in recovery, not a provider swap.

Treat a provider-specific multimodal request as a capability contract, not merely a model preference. If no other adapter has verified parity for all reference roles and generation controls, fail closed rather than routing through the generic video chain.

**Why:** Merely registering a newer model does not upgrade older adapters that forward only the first image or omit video/audio. A successful fallback in that situation is a different, unapproved render.

**How to apply:** Fence both candidate-model selection and provider selection; preserve explicitly false controls as well as enabled controls. Keep planner provenance server-authored and verifiable when a client adopts it into a durable project.

Signing a source plan is insufficient if adoption accepts an unrelated draft
alongside that signature. Derive the adopted story from the verified source;
record user-selected controls and later edits separately.

**Why:** Authentic provider metadata can otherwise be attached to different
scenes or a different script while appearing to certify that content.

**How to apply:** Treat provenance as a claim about a specific content snapshot,
not a reusable provider badge. Preserve that binding across adoption and edits.