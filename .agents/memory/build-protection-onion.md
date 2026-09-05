---
name: Build protection onion invariants
description: Non-negotiable invariants for scripts/build.js, health-gate.mjs, start-prod.sh — enforced by review; regression tests must stay green when editing startup/build scripts.
---

Production builds are wrapped in layered protection (snapshots + health gate + start-time auto-restore + rotating backup refs; full docs in `docs/BACKUP_AND_DR.md`, tests in `src/lib/recovery/dr-layers.test.ts`).

When modifying build/startup scripts, preserve these invariants (architect review blocked on each until fixed):

- **Fail-closed gating**: a build that can't be boot-probed (e.g. missing SUPABASE_* in the build env) must FAIL the build, never silently ship. The only bypass is the loudly logged `AURORA_BUILD_SKIP_HEALTH_GATE=1` / `AURORA_START_SKIP_PROBE=1` — treat as break-glass.
- **Probe attribution**: health answers must be attributed to the candidate via /proc LISTEN-socket ownership in the candidate's process group. Child-alive or fixed-port checks alone were rejected — a foreign listener can win the release-to-spawn race while a broken candidate stays alive-but-deaf.
- **Awaited cleanup**: SIGTERM→SIGKILL escalation must be awaited before `process.exit`; an unref'd timer loses to exit and leaks TERM-resistant children.
- **last-known-good** moves only after a passed gate; rotation never prunes it.

**Why:** these came from three rounds of architect review findings on real false-positive/leak scenarios, not speculation.
**How to apply:** run `bash scripts/dr-recovery-drill.sh` and `bun test src/lib/recovery` after touching any script named above; keep the foreign-listener and TERM-resistant regression tests in the mandatory suite.
