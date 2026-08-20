---
name: TanStack Nitro namespace exports
description: Production Nitro bundling can break TanStack Start server export-star namespaces.
---

Keep TanStack Start server packages external during the SSR/Nitro build instead of bundling their export-star chain.

**Why:** The bundled namespace can emit `createRequestHandler` as a free identifier, making every production request return HTTP 500 even though the dev server and package imports work.

**How to apply:** Configure Vite SSR externals for `@tanstack/react-start/server`, `@tanstack/react-start-server`, and `@tanstack/start-server-core`; verify the emitted Nitro server with both `/api/health` and `/`.