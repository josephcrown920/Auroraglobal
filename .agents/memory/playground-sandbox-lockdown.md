---
name: Playground sandbox lockdown
description: Security layers of the in-browser playground code sandbox and why none may be weakened
---

The playground runs user JS in a Blob Web Worker. Its security is layered — every layer was demanded by review and none may be removed:

1. **Token isolation (the hard boundary):** the worker never holds auth material. All API calls post `api` messages to the main thread, which attaches the Supabase bearer and enforces an allow-list (`ALLOWED_API_PATHS`).
2. **Global shadowing:** network globals (fetch, XHR, WebSocket, EventSource, importScripts, caches, Worker, SharedWorker, eval, Function) get non-configurable throwing getters on `self` AND are stripped from the whole prototype chain (`Object.getPrototypeOf(self).fetch.call(...)` was a real bypass).
3. **Dynamic import:** rejected by a strict `/\bimport\b/` lexical scan on user code (reserved word — only strings/comments can trip it).
4. **Runtime code-generation:** `eval`/`Function` blocked; `.constructor` shadowed on Function/AsyncFunction/GeneratorFunction/AsyncGeneratorFunction prototypes; string-arg setTimeout/setInterval replaced with function-only wrappers. The run handler compiles user code with a pre-captured `__RealFunction`.

**Why:** each of layers 2–4 corresponds to a concrete bypass found in architect review (prototype-chain call, runtime-synthesized `import()`, string timers). Weakening any reopens egress.

**How to apply:**
- The intrinsic `.constructor` patch is realm-guarded (`self instanceof WorkerGlobalScope`) because unit tests boot WORKER_SOURCE against a mock `self` in the shared bun realm — patching intrinsics there poisons the host process.
- `new Function`-compiled user code resolves bare identifiers from the GLOBAL scope, not the enclosing function scope — patched `console`/`self` must be passed as explicit parameters.
- WORKER_SOURCE must never contain `Bearer`, `Authorization`, or `fetch(` (asserted in tests).
