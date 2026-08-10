#!/usr/bin/env bash
set -e
cd /home/runner/workspace/artifacts/aurora-ds
if [ ! -d node_modules ]; then
  echo "[aurora-ds] Installing dependencies..."
  npm install --no-audit --no-fund
fi
# Resolve a working node (PATH node may be absent in workflow env)
NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ] && command -v available-pid2-node-paths >/dev/null 2>&1; then
  NODE_BIN="$(available-pid2-node-paths | head -1)"
fi
if [ -z "$NODE_BIN" ]; then
  echo "[aurora-ds] No node binary found" >&2
  exit 1
fi
exec "$NODE_BIN" node_modules/vite/bin/vite.js --config vite.config.ts --host 0.0.0.0
