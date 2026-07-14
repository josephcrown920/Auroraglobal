#!/usr/bin/env bash
set -e

cd /home/runner/workspace/artifacts/video-agent

# Install dependencies if node_modules is missing
if [ ! -d node_modules ]; then
  echo "[video-agent] Installing dependencies..."
  npm install
fi

# Forward Supabase creds from main app env into Vite-prefixed form
export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-$SUPABASE_URL}"
export VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-$SUPABASE_PUBLISHABLE_KEY}"

exec node_modules/.bin/vite --config vite.config.ts --host 0.0.0.0
