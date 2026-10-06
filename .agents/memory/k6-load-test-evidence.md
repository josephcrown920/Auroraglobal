---
name: k6 load-test evidence
description: k6 environment inspection and limits of rejection-path load evidence
---

Use explicit `-e NAME=value` flags when inspecting environment-dependent k6 scenarios.

**Why:** `k6 inspect` omits shell environment variables by default, unlike a normal run. Setting functional-mode variables only in the shell produced the safe-mode configuration and hid the functional thresholds.

**How to apply:** Inspect each mode with explicit flags; never use real credentials for inspection. Check scenario executors and thresholds in the output before a costly run.

Keep rejection-path throughput distinct from authenticated generation capacity.

**Why:** Fast 401/405/429 responses do not exercise credit settlement, database contention, GPU dispatch, or completion. Broad expected-status callbacks can also hide real HTTP failures.

**How to apply:** Require one terminal outcome per submitted logical flow, unique per-run idempotency keys, and endpoint-specific status assertions. Label local or synthetic evidence accurately rather than presenting it as production capacity.