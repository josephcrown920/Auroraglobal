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

**Candidates must be INVOKED to be validated, not just `-x`-checked.** The workspace PATH can
contain `.pythonlibs/bin/node` — a symlink into the DEV sandbox's Nix closure. In the prod
container that store path doesn't exist, yet `-x` still passes (the symlink itself is fine),
and exec dies with "cannot execute: required file not found" = exit 127. The only reliable
probe is actually running `"$candidate" --version` and requiring success.

**Resolution order that works in both environments (each candidate --version-validated):**
1. `command -v node` (works in prod where the nodejs module puts a real `node` on PATH;
   the probe rejects the broken `.pythonlibs` symlink case)
2. `available-pid2-node-paths`, but only if `command -v available-pid2-node-paths` succeeds
   first (guards against it being unavailable in prod)
3. LAST resort: glob `/nix/store/*-nodejs-*/bin/node`, but sorted by embedded version
   (`sort -rV`), newest first — the store holds many unrelated node versions (10.x, GraalVM
   builds); a hash-ordered "first match" can pick e.g. 20.11.1, which Vite 7 rejects
   (needs ^20.19 || >=22.12), breaking the build nondeterministically.
4. If none resolve, `exit 1` with a loud, descriptive stderr message — never a bare `exec ""`.

**Why:** silent exit 127 gives no signal about *why* the process died; explicit invoke-to-validate
resolution + a clear error message turns an opaque prod-only crash into something debuggable
from the first failed deploy log.

**How to apply:** any shared dev/prod launcher script (e.g. `scripts/replit-node.sh`) should
follow this order. Verify with `bash scripts/replit-node.sh --version` (expect the PATH node,
v22+ here). Build must run as a managed workflow, not a backgrounded bash command, or it gets
reaped mid-build (see `flat-app-publishing-blocked.md`).
