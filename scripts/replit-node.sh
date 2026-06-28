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
if [ -z "${NODE_BIN}" ]; then
  NODE_BIN="$(available-pid2-node-paths | head -1)"
fi

exec "${NODE_BIN}" "$@"
