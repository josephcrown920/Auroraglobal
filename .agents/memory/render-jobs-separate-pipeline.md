---
name: render_jobs is a live, separate pipeline from the main jobs table
description: The GPU render_jobs table/routes are an active second job pipeline, not dead scaffolding — don't assume it's unused just because it's separate from the main credit-charging jobs pipeline.
---

Aurora has two distinct job-tracking systems that look similar but are not
the same pipeline:

1. **`jobs` table** — the main credit-charging generation pipeline (studio
   generations, orchestrate() calls). Finalization is CAS-guarded on
   `locked_by` + `status = 'processing'` (see the job-finalization-fence
   memory).
2. **`render_jobs` table** — a separate GPU worker pipeline with its own
   routes (`/api/public/gpu/claim`, `/api/public/gpu/complete`). This is
   still actively used, not legacy/dead code left over from an earlier
   design.

**Why this matters:** it's easy to assume a second, similarly-named job
system is vestigial and skip it when auditing for race conditions or
consistency bugs. `complete.ts` was found missing the same CAS guard
(`.eq("status", "running")` + idempotent no-op on an already-finalized job)
that `claim.ts` and the main `jobs` pipeline already had — a real bug, not
theoretical, because the table is genuinely live.

**How to apply:** when auditing job/worker finalization logic, check BOTH
`jobs` and `render_jobs` write paths independently. Don't assume fixing one
covers the other just because they look like the same concept.
