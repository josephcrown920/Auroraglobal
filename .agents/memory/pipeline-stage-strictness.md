---
name: Pipeline stage strictness (multi-stage renders)
description: Multi-stage render pipelines must treat every spec-listed stage as required — fail-fast preflights, no swallowed stage errors, no silent partial output.
---

Rule: In a multi-stage render pipeline (e.g. /kids: script → illustration → image-to-video → per-scene TTS → music → ffmpeg assemble), every stage the spec lists as part of the deliverable is REQUIRED. Do not treat a stage (TTS narration, music, a worker capability, etc.) as "optional / skip on failure". Each stage must:
- have a fail-fast preflight when its backend/credential is missing — throw a terminal error whose message contains "required" so the job releases the reservation + marks the row failed (= refund) BEFORE spending on earlier paid stages;
- never swallow its own failure — record a per-item error (e.g. `scenes[i].error`) and RE-THROW so the normal classify → retry(transient)/release+fail(terminal) path runs;
- treat empty input (a scene with no narration text) and post-processing gaps (an unsigned narration URL at assembly) as terminal too.

**Why:** Architect review rejected the kids-story task twice on the same theme — a stage that could silently no-op produced a "succeeded" render missing part of the deliverable (first the worker never advertised the `assemble` capability, so it would have failed every story; then TTS was caught-and-skipped, shipping videos with no narration). Aurora's house rule is explicit-failure, no silent fallback; a delivered-but-incomplete render is worse than a clean refund.

**How to apply:** When adding or reviewing any pipeline stage, ask "can this be skipped or swallowed and still reach `succeeded`?" If yes, add a preflight + re-throw. Also keep ALL row writes owner-scoped (id + user_id), not just the terminal-failure write. Worker capability defaults must advertise what the pipeline needs (e.g. `assemble` whenever ffmpeg is present), or the preflight fails every job.
