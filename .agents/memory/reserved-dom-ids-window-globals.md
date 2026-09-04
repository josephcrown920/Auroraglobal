---
name: Element ids shadow window globals (id="process" broke dev sign-in)
description: Browser named access turns element ids into window properties; an id of `process` hijacks Vite's dev-time process.env defines and crashes lazily-imported server-function modules.
---

**Rule:** Never give markup an id (or `name`) that a bundler/runtime reads as a global: `process`, `global`, `globalThis`, `module`, `exports`, `require`, `define`, `Buffer`. Guarded by `src/lib/reserved-dom-ids.test.ts` (scans src markup for the literal pattern).

**Why:** Browsers expose element ids as `window.<id>` (named access). In `vite dev`, TanStack Start's `process.env.TSS_SERVER_FN_BASE` etc. are not statically replaced — `/@vite/env` writes them onto `globalThis.process`, and `globalThis.process || (globalThis.process = {})` found the landing's `<section id="process">` instead, so `env` was attached to a DOM node. After hydration re-created that node (or on navigation away), `process.env` was undefined and every module that calls `createClientRpc` at import time (`*.functions.ts`) threw `Cannot read properties of undefined (reading 'TSS_SERVER_FN_BASE')` → `/auth` route error when reached by client navigation from the landing, while a direct `/auth` load worked. Production builds are unaffected (define is applied statically), so this only bites the Replit preview — which is where the owner tests.

**How to apply:** A route that works on direct load but errors when navigated to from the landing is the fingerprint; check `Object.keys(window.process)` in the console (a DOM node shows `__reactProps$…`). Tailwind's disabled breakpoints mean landing responsive tweaks go in raw `@media` rules under `.landing-nav`.
