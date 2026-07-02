#!/usr/bin/env bash
# Resolve a real Node binary, then exec it with the given args.
#
# This app's SSR build/runtime must run under REAL Node — Bun napi-panics on it.
# Replit's deploy/autoscale images expose `node` on PATH (the nodejs-24 module),
# but the Replit dev sandbox does NOT, so fall back to the runtime-path helper
# that the dev workflow already uses. This keeps the production build/run commands
# working in both environments.
set -euo pipefail

NODE_BIN="$(command -v node 2>/dev/null || true)"

# available-pid2-node-paths is a dev-sandbox-only helper (not present in the
# production/autoscale container) — only call it if it actually exists,
# otherwise `set -e` would abort this script with a bare "command not found".
if [ -z "${NODE_BIN}" ] && command -v available-pid2-node-paths >/dev/null 2>&1; then
  NODE_BIN="$(available-pid2-node-paths | head -1)"
fi

# Last-resort fallback: some environments (e.g. this repl's dev sandbox) only
# expose a real `node` binary via a Nix store path that isn't symlinked onto
# PATH. Search for one directly rather than failing silently.
if [ -z "${NODE_BIN}" ] || [ ! -x "${NODE_BIN}" ]; then
  for candidate in /nix/store/*-nodejs-*/bin/node; do
    if [ -x "${candidate}" ]; then
      NODE_BIN="${candidate}"
      break
    fi
  done
fi

if [ -z "${NODE_BIN}" ] || [ ! -x "${NODE_BIN}" ]; then
  echo "replit-node.sh: could not locate a Node.js binary (checked \`node\` on PATH, available-pid2-node-paths, and /nix/store nodejs packages)." >&2
  exit 1
fi

exec "${NODE_BIN}" "$@"
