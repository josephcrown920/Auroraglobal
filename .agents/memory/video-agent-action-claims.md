---
name: Video Agent action claims
description: Concurrency and provenance rules for paid NBA Josh production actions.
---

Paid Video Agent actions must claim the editable project row with a compare-and-set transition before any mutation or provider reservation. Persist success or failure only while holding that processing claim, then return the row to an editable state.

**Why:** UI loading states are advisory and multiple tabs or retries can otherwise reserve credits twice or overwrite a newer production state.

**How to apply:** Use the project status transition as the server-side fence for still approval/generation, still selection, motion approval, preview generation, and final rendering. Persist the actual provider and endpoint returned by the orchestration result alongside the requested model so fallback behavior remains visible.