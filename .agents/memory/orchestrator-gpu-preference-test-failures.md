---
name: Pre-existing orchestrator worker-routing test failures
description: 10 orchestrator tests (gpu-preference, free-mode, selfhosted-integration) fail on a clean checkout — worker pool never selected in the mocks
---

10 tests fail on an otherwise-unmodified checkout (confirmed 2026-07-06 with 4;
re-confirmed and expanded to 10 on 2026-07-08 by swapping the only touched file back to
its HEAD version and re-running — identical failures):

- `orchestrator.gpu-preference.test.ts` — 4 of 6 (self-hosted-first routing for
  still/video/lipsync + circuit-break fallback)
- `orchestrator.free-mode.test.ts` — 2 of 11 (Free-GPU-only still + video routing)
- `orchestrator.selfhosted-integration.test.ts` — 4 of 9 (selfHostedOnly lipsync ×2,
  assemble, lyric_video)

Shared fingerprint: the mocked online worker is never dispatched to — orchestrate()
goes straight to an external provider (or throws "Your free GPU isn't running") even
though `workersQueryResult` returns an eligible worker. Not test-order/mock.module
leakage (fails in file isolation too).

**Why this matters:** don't treat these failures as caused by unrelated work (pricing,
registration, etc.) and don't try to fix them as a side effect — it's a pre-existing
gap in the orchestrator's self-hosted-pool eligibility path (or its test mocks) that
needs its own investigation. Baseline for a "green" full run is currently
`bun test src` = all pass EXCEPT these 10.

**How to apply:** if the full suite shows unexpected failures after a change, prove
pre-existence cheaply: copy the HEAD version of your touched file(s) over via
`git show HEAD:path > /tmp/x && cp` (git stash is blocked for the main agent), re-run
the failing files, restore.

**Update 2026-07-13:** a full `bun test src/` run on a clean tree came back 732 pass / 0 fail — the 10 worker-routing failures did NOT reproduce. Before dismissing failures in these files as "pre-existing baseline", re-run once; the baseline may now be green.
