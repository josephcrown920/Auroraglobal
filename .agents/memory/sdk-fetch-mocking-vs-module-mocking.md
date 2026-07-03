---
name: Test provider SDKs via fetch mocking, not mock.module
description: Why globalThis.fetch mocking beats mock.module for OpenAI/@google/genai adapters, plus a client-caching pitfall it exposed.
---

When a new test file needs to stub an SDK (OpenAI, `@google/genai`) that sibling test files import for real (directly or transitively through a shared module like `orchestrator.server.ts`), do NOT `mock.module("openai" | "@google/genai", ...)` — Bun's `mock.module` is process-global and order-dependent, so it leaks into every other suite that imports the real SDK (see `bun-mock-module-leakage.md`). Instead mock `globalThis.fetch` directly: both SDKs resolve `fetch` as a bare identifier per-call, so intercepting it works regardless of file load order and doesn't touch other suites.

Building the fake `Response` correctly matters: `@google/genai`'s `HttpResponse` wrapper calls `response.headers.entries()`, so the fake needs a real `Headers` object, not a plain object literal. For error responses, force content-type to `application/json` and put the body under a `json` field (not `text`) — otherwise the SDK's error path leaves `message` as `undefined` and any downstream regex matching on the error string (e.g. a circuit-breaker's provider-down detector) silently fails to match.

**Why:** this surfaced a real production bug — a module-level singleton client (`getReplitOpenAI()`) constructed once and cached would freeze whatever `globalThis.fetch` existed at construction time, because the OpenAI SDK resolves `options.fetch ?? getDefaultFetch()` in its constructor, not per-request. That breaks both tests (a later `beforeEach` fetch swap has no effect on an already-built client) and any real runtime fetch-shimming.
**How to apply:** for any adapter wrapping a provider SDK, construct the client fresh per-call instead of caching it as a module singleton, unless you've confirmed the SDK re-resolves `fetch` on every request. Client construction is cheap (no network call), so the cost is negligible.
