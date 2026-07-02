---
name: Node binary resolution for scripts shared by dev sandbox and prod deploy
description: How to safely resolve a real node binary in a wrapper script that runs both in the Replit dev sandbox and the production autoscale/deploy image, without silent exit 127s.
---

`available-pid2-node-paths` is a dev-sandbox-only Nix-provided helper. It is not guaranteed
to exist in the production autoscale/deploy image, which instead exposes `node` directly on
PATH (via the declared Nix module, e.g. `nodejs-24`). A wrapper script used as both the dev
`run` command and the production `build`/`run` command must not treat the sandbox helper as
a required fallback — if it's absent, `NODE_BIN` ends up empty and `exec "" ...` fails with
an opaque exit 127, which then cascades into permanent deploy healthcheck failures.

**Resolution order that works in both environments:**
1. `command -v node` (works in prod where nodejs module puts `node` on PATH)
2. `available-pid2-node-paths`, but only if `command -v available-pid2-node-paths` succeeds
   first (guards against it being unavailable in prod)
3. A direct glob fallback over `/nix/store/*-nodejs-*/bin/node`
4. If none resolve, `exit 1` with a loud, descriptive stderr message — never a bare `exec ""`.

**Why:** silent exit 127 gives no signal about *why* the process died; explicit resolution +
a clear error message turns an opaque prod-only crash into something debuggable from the
first failed deploy log.

**How to apply:** any shared dev/prod launcher script (e.g. `scripts/replit-node.sh`) should
follow this order. Verified end-to-end by running the actual `[services.production]`
build (`vite build` → `.output/server/index.mjs`) and run (`node .output/server/index.mjs`)
commands from artifact.toml directly in the sandbox — build must run as a managed workflow,
not a backgrounded bash command, or it gets reaped mid-build (see
`flat-app-publishing-blocked.md`).
