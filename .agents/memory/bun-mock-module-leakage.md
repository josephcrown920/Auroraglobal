---
name: Bun mock.module is process-global
description: Why mocking a shared module in one *.test.ts file breaks other suites, and the DI fix.
---

Bun's `mock.module(path, factory)` is **process-global and persistent** for the whole `bun test` run, not scoped to the file that calls it. Mocking a leaf module that is ONLY reached through the mock (e.g. `@/integrations/supabase/client.server`, `./hf.server`) is fine — every suite re-registers its own stub. But mocking a module that OTHER suites import for REAL silently leaks the stub into them (order-dependent), and the contaminated suite returns byte-identical stub output.

**Why:** Observed concretely — a jobs worker test did `mock.module("./orchestrator.server", () => ({ orchestrate: stub }))`. In isolation every file passed; under full `bun test src/` the real orchestrator routing tests started returning the jobs stub's default `{url, provider:"pollinations", endpoint:"pollinations:flux"}` for image AND video (pollinations isn't even a video provider — structurally impossible via real routing), proving the import resolved to the leaked stub.

**How to apply:** Never `mock.module(...)` a module another test file exercises real. Instead make the consumer **dependency-inject** that collaborator (thread it as a param with a `defaultDeps` fallback to the real import) and pass a fake from the test. Module-level shared state in the real module (e.g. orchestrator's `HEALTH` Map keyed by `Date.now()` cooldowns) is likewise shared across all suites in the run — reset it in `beforeEach` if a test depends on it. If a full-suite failure can't be reproduced by running the file alone, suspect cross-file `mock.module`/global state, not the file under test.
