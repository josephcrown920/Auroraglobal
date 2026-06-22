---
name: Replit vite sandbox binding
description: Getting a Lovable @lovable.dev/vite-tanstack-config app to serve in the Replit proxied preview.
---

# Running @lovable.dev/vite-tanstack-config in the Replit sandbox

Two distinct failures hit in sequence (took several attempts):

1. **IPv6 bind crash**: running `vite dev` (or with `PORT=8080`) makes the config bind to
   `:::8080` (IPv6 `host: true`). The Replit sandbox has no IPv6 → `listen EAFNOSUPPORT:
   address family not supported :::8080`. Must bind IPv4 `0.0.0.0`.
2. **Host blocked (HTTP 403)**: the proxied preview comes from a different host, so vite
   returns `Blocked request. This host is not allowed.` unless allowedHosts permits it.

**Fix (in `vite.config.ts`):** use the documented escape hatch — the `vite` passthrough —
rather than CLI flags, so both stick:
```ts
export default defineConfig({
  tanstackStart: { server: { entry: "server" } },
  vite: { server: { host: "0.0.0.0", allowedHosts: true } },
});
```
Workflow command: `bunx vite dev --host 0.0.0.0 --port 8080` (port 8080 → external 80).

**Why:** the config's sandbox detection chooses `host: true` (→ IPv6) and does not always
set allowedHosts for the Replit domain. CLI `--host` overrides the bind but cannot set
allowedHosts, so allowedHosts must come from the config passthrough.
