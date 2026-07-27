#!/usr/bin/env bash
# Regenerates the tutorial PDF from the live /tutorial page.
#
# Prerequisites:
#   1. The dev server must be running on http://localhost:8080
#      (start via the "Start application" workflow in Replit, or
#       run: bash scripts/replit-node.sh node_modules/vite/bin/vite.js dev --host 0.0.0.0 --port 8080)
#
# Output:  3 PDF files are written/updated:
#   public/tutorial-guide.pdf
#   public/Aurora-Studio-Tutorial-Guide.pdf
#   artifacts/web/public/Aurora-Studio-Tutorial-Guide.pdf
#
# Usage:
#   bash scripts/regen-tutorial-pdf.sh
set -euo pipefail

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WORKSPACE_ROOT"

# ── Resolve the right node binary ─────────────────────────────────────────
NODE=""

# Prefer the Replit-provided Node (same one Vite uses) via the helper
if command -v available-pid2-node-paths &>/dev/null; then
  while IFS= read -r candidate; do
    if [[ -x "$candidate" ]] && "$candidate" --version &>/dev/null; then
      NODE="$candidate"
      break
    fi
  done < <(available-pid2-node-paths 2>/dev/null)
fi

# Fallback to PATH node
if [[ -z "$NODE" ]]; then
  NODE="$(command -v node 2>/dev/null || true)"
fi

if [[ -z "$NODE" ]]; then
  echo "ERROR: Could not locate node. Run this script from the Replit workspace." >&2
  exit 1
fi

echo "node: $NODE  ($("$NODE" --version))"
echo ""
echo "Starting tutorial PDF regeneration…"
echo "  (dev server must be running on http://localhost:8080)"
echo ""

exec "$NODE" "$WORKSPACE_ROOT/scripts/gen-tutorial-pdf.cjs"
