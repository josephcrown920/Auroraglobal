---
name: Bun mock.module is process-global
description: Why mocking a shared module in one *.test.ts file breaks other suites, and the DI fix.
---

Bun's `mock.module(path, factory)` is **process-global and persistent** for the whole `bun test` run, not scoped to the file that calls it. Mocking a leaf module that is ONLY reached through the mock (e.g. `@/integrations/supabase/client.server`, `./hf.server`) is fine — every suite re-registers its own stub. But mocking a module that OTHER suites import for REAL silently leaks the stub into them (order-dependent), and the contaminated suite returns byte-identical stub output.

**Why:** Observed concretely — a jobs worker test did `mock.module("./orchestrator.server", () => ({ orchestrate: stub }))`. In isolation every file passed; under full `bun test src/` the real orchestrator routing tests started returning the jobs stub's default `{url, provider:"pollinations", endpoint:"pollinations:flux"}` for image AND video (pollinations isn't even a video provider — structurally impossible via real routing), proving the import resolved to the leaked stub.

**How to apply:** Never `mock.module(...)` a module another test file exercises real. Instead make the consumer **dependency-inject** that collaborator (thread it as a param with a `defaultDeps` fallback to the real import) and pass a fake from the test. Module-level shared state in the real module (e.g. orchestrator's `HEALTH` Map keyed by `Date.now()` cooldowns) is likewise shared across all suites in the run — reset it in `beforeEach` if a test depends on it. If a full-suite failure can't be reproduced by running the file alone, suspect cross-file `mock.module`/global state, not the file under test.

Concurrent suites can also race through a shared provider registry even after
the module mock is removed. If a compatibility test needs a custom registry,
inject that map into the consumer rather than calling a global
`setProviderRegistryForTest`; per-test dependency injection keeps parallel
files from changing each other's provider order or model IDs.

**Why:** The wrapper and routing suites passed alone but failed together when
the wrapper's singleton registry replaced the live routing registry during a
parallel test.

**How to apply:** Prefer injected provider registries and transport functions
for router compatibility tests; reserve global registry seams for tests that
run in isolation.

## Corollary: incomplete stubs are latent bombs (2026-08-12)
A `mock.module("./x", ...)` stub that omits some of x's real exports doesn't just affect its own suite — when it leaks, any OTHER suite whose import graph pulls the missing export dies at link time with `SyntaxError: Export named 'Y' not found`, order-dependently (green one run, red the next). Adding a NEW test file that imports a heavy server module for real can trip stubs that sat harmless for months in unrelated suites.
**How to apply:** when stubbing a shared module, cover EVERY export that any transitive importer touches (grep the real module's `export` list); when a full-suite run shows a missing-export SyntaxError that an isolated run doesn't, hunt for the incomplete stub in OTHER files instead of debugging the named module.

**Adding a top-level import to a widely-stubbed module breaks every stub:** when a new export of a stubbed module (e.g. replicate.server) starts being imported at top level by the graph (orchestrator.server), EVERY suite's `mock.module` stub of that module must gain the export too, or those suites crash at import ("Export named ... not found") whenever they run before a real import of the module — grep all stubs of the module and sweep them in the same change.
