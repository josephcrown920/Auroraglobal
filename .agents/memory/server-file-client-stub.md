---
name: Server-file client stub vs .functions convention
description: Why client-called server functions must live in *.functions.ts, not *.server.ts
---

The root vite config has a `serverFileClientStub` plugin that replaces every `*.server.ts` module with throw-only stubs in the CLIENT bundle (error: "<path> is server-only and was stubbed out of the client bundle").

**The trap:** `createServerFn` definitions placed in a `*.server.ts` file compile and typecheck fine, and even render fine — they only explode (or silently no-op inside catch blocks) when the client actually CALLS them. The entire WebAuthn passkey feature shipped dead this way: sign-in and registration buttons did nothing for weeks because every failure path had a silent catch.

**The rule:** client-called `createServerFn` wrappers live in `*.functions.ts` files (house convention, e.g. `tiktok-posting.functions.ts`, `webauthn.functions.ts`). Top-level imports of server-only modules (supabaseAdmin, *.server helpers) inside a `.functions.ts` file are fine — the TanStack Start compiler strips handler bodies from the client build.

**How to apply:** when a button/query "does nothing" with no toast, check whether the server fn it calls lives in a `*.server.ts` file before debugging deeper. When adding new server fns that any route imports, name the file `*.functions.ts` from the start. An empty-state UI does NOT prove a query round-tripped — a stubbed/failing useQuery with `data ?? []` renders the same empty state.
