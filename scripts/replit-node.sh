#!/usr/bin/env bash
# Resolve a real Node binary, then exec it with the given args.
#
# This app's SSR build/runtime must run under REAL Node — Bun napi-panics on it.
#
# `available-pid2-node-paths` is a dev-sandbox-only helper (backed by a Replit
# runtime-path Nix package) that is NOT guaranteed to exist in the production
# autoscale/deploy image. Relying on it there causes `NODE_BIN` to end up
# empty and `exec "" ...` to fail with an opaque "exit 127" — the deploy
# healthcheck then fails forever because the server never starts.
#
# To keep both the dev sandbox and production deploys working, resolve Node
# in order of preference:
#   1. `node` on PATH (present in the deploy image via the nodejs-24 Nix module)
#   2. the dev-sandbox `available-pid2-node-paths` helper, if it exists
#   3. a direct glob for a nodejs Nix store package (belt-and-suspenders)
# If none of these produce a working binary, fail loudly with a clear message
# instead of a silent/opaque exit 127.
set -euo pipefail

NODE_BIN="$(command -v node 2>/dev/null || true)"

# available-pid2-node-paths is a dev-sandbox-only helper (not present in the
# production/autoscale container) — only call it if it actually exists,
# otherwise `set -e` would abort this script with a bare "command not found".
if [ -z "${NODE_BIN}" ] && command -v available-pid2-node-paths >/dev/null 2>&1; then
  NODE_BIN="$(available-pid2-node-paths 2>/dev/null | head -1 || true)"
fi

# Last-resort fallback: some environments only expose a real `node` binary via
# a Nix store path that isn't symlinked onto PATH. Search for one directly
# rather than failing silently.
if [ -z "${NODE_BIN}" ] || [ ! -x "${NODE_BIN}" ]; then
  for candidate in /nix/store/*-nodejs-*/bin/node; do
    if [ -x "${candidate}" ]; then
      NODE_BIN="${candidate}"
      break
    fi
  done
fi

if [ -z "${NODE_BIN}" ] || [ ! -x "${NODE_BIN}" ]; then
  echo "FATAL: scripts/replit-node.sh could not resolve a working Node.js binary." >&2
  echo "  - 'node' was not found on PATH." >&2
  echo "  - The dev-sandbox 'available-pid2-node-paths' helper was unavailable or returned nothing." >&2
  echo "  - No nodejs Nix store package was found under /nix/store/*-nodejs-*/bin/node." >&2
  echo "  Ensure the 'nodejs-24' module is declared in .replit and available in this environment." >&2
  exit 1
fi

exec "${NODE_BIN}" "$@"
