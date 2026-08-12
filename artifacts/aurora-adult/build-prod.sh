#!/usr/bin/env bash
# Production build for the Adult School artifact (static SPA).
#
# The autoscale deployer runs this as the artifact's production build command.
# It must NOT rely on `pnpm` (this repo is flat npm/bun, pnpm is not installed —
# see aurora-ds-dev-runner memory) nor on a bare `node` (the prod image PATH can
# resolve `node` to a dangling .pythonlibs symlink — see replit-node.sh). So we
# resolve a real Node via the shared scripts/replit-node.sh and invoke vite
# through it.
set -euo pipefail

cd /home/runner/workspace/artifacts/aurora-adult

# Ensure deps are installed in the deploy image (node_modules is .replitignore'd).
if [ ! -d node_modules ]; then
  echo "[aurora-adult] Installing dependencies for production build..."
  npm install --no-audit --no-fund
fi

# BASE_PATH pins vite's `base` so all asset URLs are prefixed with /aurora-adult/.
export BASE_PATH="${BASE_PATH:-/aurora-adult/}"
export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-$SUPABASE_URL}"
export VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-${SUPABASE_PUBLISHABLE_KEY:-}}"

exec bash /home/runner/workspace/scripts/replit-node.sh \
  node_modules/vite/bin/vite.js build --config vite.config.ts
