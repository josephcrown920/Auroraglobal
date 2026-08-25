#!/usr/bin/env bash
set -e
cd /home/runner/workspace/artifacts/aurora-adult
if [ ! -d node_modules ]; then
  echo "[aurora-adult] Installing dependencies..."
  npm install
fi
export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-$SUPABASE_URL}"
export VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-$SUPABASE_PUBLISHABLE_KEY}"
exec node_modules/.bin/vite --config vite.config.ts --host 0.0.0.0
