---
name: Smoke steps must share production dispatch
description: Smoke-test helpers must call the same internal dispatch helpers as production server fns, never re-implement their internals.
---

**Rule:** When a smoke step needs to exercise a server-fn pipeline (e.g. the template studio chain), extract the handler body into an internal `_enqueue*` / `_dispatch*` helper and call that helper from BOTH the production handler and the smoke runner. Never rebuild the handler's internals (direct `reserveGenerationJob` calls, hand-copied gating) inside the smoke helper.

**Why:** Code review rejected the "mirror" approach twice on the studio-chain smoke step: a parallel reconstruction keeps passing while real dispatch breaks whenever handler logic changes (preview gating, entitlement caps, payload shaping). The shared-helper pattern (`_dispatchAvatarShot`, `_enqueuePerformanceShot`, `_enqueueVideoFromImage`, `_enqueueLipSync`) makes drift impossible.

**How to apply:** Handlers become thin wrappers: `.handler(({ data, context }) => _enqueueX(context.userId, data))`. Smoke calls `_enqueueX(userId, {...})` with schema-typed data (parse plain strings through the zod enum, e.g. `Schema.shape.model.parse(...)`), then polls the job to completion and asserts non-empty result URLs before chaining stages. Omitting `confirmPreviewId` deliberately exercises the preview gate (forced 480p/≤5s).

**Multi-scene exports:** A pure scene-planning test is not enough to verify a long video. Exercise the actual worker dispatch with dependency-injected assembly/upload boundaries, asserting each provider scene request, timeline normalization, final caption pass, and the persisted export URL.

**Why:** Planning can preserve every word while the downstream assembler still trims scenes or the worker saves an uncaptioned intermediate result.

**How to apply:** Keep the production runner in the test path; replace only expensive media/network boundaries. Distinguish mocked duration-contract evidence from a real FFprobe measurement.
