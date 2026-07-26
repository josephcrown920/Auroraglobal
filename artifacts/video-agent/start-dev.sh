#!/usr/bin/env bash
set -e

cd /home/runner/workspace/artifacts/video-agent

# Install dependencies if node_modules is missing or package.json changed
if [ ! -d node_modules ]; then
  echo "[video-agent] Installing dependencies..."
  npm install
fi

# Use the same Node binary resolution as the main Aurora app:
# prefer the PID-2 node (Replit's managed runtime), no PATH node fallback needed.
NODE_BIN="$(available-pid2-node-paths | head -1)"
if [ -z "$NODE_BIN" ]; then
  NODE_BIN="node"
fi

exec "$NODE_BIN" node_modules/vite/bin/vite.js dev --host 0.0.0.0 --port "${PORT:-8089}"
