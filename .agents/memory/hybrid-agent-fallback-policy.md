---
name: Hybrid agent fallback policy
description: User-approved separation of brain and render fallback, with transparent automatic recovery.
---

Aurora's default hybrid mode should automatically try compatible backups for both agent brains (chat, scripts, planning) and rendering. “No silent fallback” means disclose the actual serving engine, not require manual intervention for every provider failure. Retain Seedream and Seedance as choices; Google-only is an optional constrained mode.

**Why:** The user explicitly clarified that fallback is wanted for the agent's brain as well as media generation, after screenshots showed retired models stopping planning.

**How to apply:** Preserve context and validated output contracts across bounded brain retries. Media backups must support the same reference inputs, identity and motion requirements; ordinary text-to-video is not a substitute for performance transfer. Never exceed approved cost or change the engine behind an approved final without a replacement preview approval. Authentication errors require sign-in recovery, not a provider swap.