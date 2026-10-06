#!/usr/bin/env bash
set -euo pipefail

# Resolve the artifact directory from this script's location so CI runners,
# local checkouts, and Replit can all start the app without assuming a fixed
# workspace path.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d node_modules ]; then
  echo "[aurora-adult] Installing dependencies..."
  npm install
fi

export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-${SUPABASE_URL:-}}"
export VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-${SUPABASE_PUBLISHABLE_KEY:-}}"

exec node_modules/.bin/vite --config vite.config.ts --host 0.0.0.0
