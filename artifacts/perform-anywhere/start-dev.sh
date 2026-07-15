#!/usr/bin/env bash
set -e
cd /home/runner/workspace/artifacts/perform-anywhere
if [ ! -d node_modules ]; then
  echo "[perform-anywhere] Installing dependencies..."
  npm install
fi
exec node_modules/.bin/vite --config vite.config.ts --host 0.0.0.0
