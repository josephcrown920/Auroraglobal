---
name: inference.sh backend
description: Verified wire contract quirks for the inference.sh cloud apps API (protocol "inferencesh")
---

Contract verified live (docs + curl, July 2026):
- POST {base}/run with `{app, input, setup?}`, headers `Authorization: Bearer inf_...` AND `X-API-Version: 2` (omitting the version header hits the v1 contract). Poll GET {base}/tasks/{id}.
- Terminal statuses are numeric: 10=Completed, 11=Failed, 12=Cancelled — not strings.
- Outputs nest URLs under `uri` (e.g. `{image:{uri}}`), which is why "uri" is in both URL-extraction key lists (inference layer + orchestrator) — keep them in lockstep.
- `/openapi.json` is public (200 unauthenticated) but skeletal (no schemas) — fine as a health probe, useless for codegen.
- Apps are heterogeneous: only image has a safe default app (`infsh/flux`); every other task needs an explicit `INFERENCE_SH_APP_<TASK>` env mapping, and callers fail explicitly without one.

**Why:** contract details required live probing (docs alone were ambiguous on version header + numeric statuses); re-deriving them costs real API calls.
**How to apply:** any change to the inferencesh protocol must touch protocols.ts AND orchestrator dispatch in lockstep (see gpu-pluggability memory); INFERENCE_SH_API_KEY still unset as of task completion.
