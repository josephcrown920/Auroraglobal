---
name: TanStack Start server packages must NOT be ssr.external
description: Externalizing start-server-core breaks ALL server fns in prod; the old namespace-export fix is obsolete and was actively harmful.
---

Never mark `@tanstack/react-start/server`, `@tanstack/react-start-server`, or `@tanstack/start-server-core` as `ssr.external` / Nitro externals. Bundle them through the Start plugin pipeline.

**Why:** `start-server-core` resolves its server-fn lookup via the `#tanstack-start-server-fn-resolver` subpath import. Inside the Start plugin pipeline that import maps to the generated manifest; when the package is externalized, Nitro pulls it from node_modules where the subpath resolves to the package's FAKE no-op resolver (`async function getServerFnById() {}`). Result: every server fn and SSR loader resolves `undefined` → prod-wide 500s (`hidden` destructuring error) while dev works fine. This took the live site's feature routes down in Aug 2026.

The earlier "createRequestHandler unbound" namespace-export problem this external was added for (2026-08-20) no longer reproduces after removal — verified full prod build + boot + `/` + feature routes 200 + a real `/_serverFn/<id>` RPC probe returning a proper serialized response.

**How to apply:** If a prod build breaks inside these packages, fix it another way (version alignment, npm overrides) — never externals. Verify any change with a full prod build, then boot `.output/server/index.mjs` and probe BOTH a page route and a real server-fn id extracted from the built manifest (`grep -B2 'functionName: "<fn>' .output/server/_ssr/index.mjs`).

**Dynamic imports are a second trigger:** any dynamic `await import("@tanstack/react-start/server")` in app code makes Rollup emit the package's frozen namespace object in the prod SSR bundle while tree-shaking drops `createRequestHandler`, leaving an unbound reference that crashes the whole server at module load. Always use static named imports from that package.

**Build memory note:** the nitro transform phase needs ~4GB free; with the dev server, tsserver, and the github-sync `git pack-objects` (~1.7GB spikes) running, the 8GB container OOM-kills the build silently at the same "transforming (…)" line. Free memory first (kill tsserver, pause sync daemon, restart dev workflow) before blaming the build itself.
