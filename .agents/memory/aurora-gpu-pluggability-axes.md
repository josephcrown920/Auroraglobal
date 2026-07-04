---
name: Aurora GPU pluggability — two parallel axes
description: Why Aurora has two separate GPU backend layers and how to add a new protocol without breaking either.
---

Aurora deliberately keeps **two** GPU backend abstractions, not one:

1. **Env-based `inference/` layer** (`src/lib/inference/*`) — standalone/status. `providerStatus()` + `runInferenceAuto`; reads env vars; powers the admin "Pluggable GPU backends" panel and any direct, non-pool calls.
2. **DB `gpu_workers` registry** (`src/lib/orchestrator.server.ts`) — the live `/generate` worker pool used by the failover chains. `protocol` is a free-text column (no migration / no enum at the DB level).

Both speak the same backend protocols (`custom`, `runpod`, `comfyui`, `hfspace`, `vast`) and share their **wire logic** through `src/lib/inference/protocols.ts` (pure, env-agnostic: `jobBody`, `extractOutputUrl`, `postFlatJob`, `callGradioSpace`/`gradioData`/`extractGradioUrl`, `runComfyWorkflow`, `toResult`). protocols.ts is the single source of truth for HTTP-out per protocol.

**Why:** the architect explicitly approved keeping both axes. They serve different consumers (status/standalone vs the live pool) and collapsing them would couple env config to the DB pool. Keeping protocols.ts shared avoids duplicating each backend's quirky wire format in two places.

**How to apply — adding/altering a backend protocol:**
- Put the wire logic in `protocols.ts` only; both layers call it.
- Update the env adapter (`inference/providers/<p>.ts` + adapters map + `providerStatus`) AND the orchestrator dispatch switch (`dispatchComfyui`/`dispatchHfspace`/etc.) — touching one but not the other silently leaves a layer behind.
- Widen the protocol zod enum in `workers.functions.ts` and the admin dropdown/help in `admin.tsx`, and add a per-protocol health probe branch in `gpu-worker-health.ts`.
- Custom/runpod dispatch in the orchestrator is byte-identical legacy behavior pinned by `toMatchObject` tests — keep it that way.

**Explicit-failure rule (no silent fallback):** ComfyUI dispatch throws if no `comfyWorkflow` is supplied; `runInferenceAuto` throws when no configured capable backend exists. Failures are logged and surface through normal failover — never swallowed.

**Per-backend real capabilities (resolved):** `ProviderAdapter.tasks` is the protocol's theoretical max, not real capability. `effectiveTasks()` in `inference/index.ts` narrows it via `capabilitiesEnvVar` (a `<PREFIX>_TASKS` CSV env var per adapter — e.g. `RUNPOD_TASKS=image,video`) or a bespoke `resolveTasks()` (inference.sh derives it from which `INFERENCE_SH_APP_<TASK>` vars are mapped). `providerStatus()`/`runInferenceAuto` both route on the narrowed list; unset stays at the old overstated default (real capability unknown until the owner declares it). The DB `gpu_workers` layer already had true per-worker `capabilities` — this only fixed the env layer.
