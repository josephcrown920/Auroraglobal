---
name: Aurora client-safe cost/estimate helpers
description: Why feature cost constants live in a dependency-light shared module a client route can import, never in *.server.ts
---

# Client-safe cost / estimate helpers

When a client route needs to show an up-front credit/Aura estimate, it must read
the cost from a **dependency-light shared module** (e.g. `cm.server.ts` despite the
name is pure — no DB, no imports). That module must NOT `import` any real
`*.server.ts` (e.g. `ugc.server.ts`), because those transitively pull server-only
LLM/secrets code, and importing them from a route bundles that code into the client
(or breaks SSR).

**Why:** building the Content Machine, `cm.server.ts` originally `import { COST_UGC_AD } from "./ugc.server"`. ugc.server pulls server-only LLM code, so the route could not safely import the estimate. Decoupling was required.

**How to apply:** define the feature's flat cost as a local literal in the pure
shared module (e.g. `COST_PER_VIDEO = 8`) so the route and the reserve path share
ONE source. To stop it drifting from the canonical server constant, add a unit test
(runs in bun/server context, so it may import the server module) asserting equality:
`expect(COST_PER_VIDEO).toBe(COST_UGC_AD)`. The estimate shown must equal what
`create_generation_and_reserve` actually reserves.
