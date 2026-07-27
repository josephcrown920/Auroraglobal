#!/usr/bin/env bash
# CI freshness check: fails if any tutorial source file is newer than the PDF.
#
# This runs fast (pure filesystem stat) and does NOT require the dev server.
# Registered as the "tutorial-pdf" validation command.
#
# To fix a failure: run  bash scripts/regen-tutorial-pdf.sh
#   (requires dev server on :8080)
set -euo pipefail

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PDF="$WORKSPACE_ROOT/public/Aurora-Studio-Tutorial-Guide.pdf"

SOURCES=(
  "$WORKSPACE_ROOT/src/components/tutorial/TutorialColors.tsx"
  "$WORKSPACE_ROOT/src/components/tutorial/TutorialMotion.tsx"
  "$WORKSPACE_ROOT/src/components/tutorial/TutorialLipSync.tsx"
  "$WORKSPACE_ROOT/src/components/tutorial/shared.tsx"
  "$WORKSPACE_ROOT/src/components/tutorial/tokens.ts"
  "$WORKSPACE_ROOT/src/routes/tutorial.lazy.tsx"
)

# ── Check PDF exists ───────────────────────────────────────────────────────
if [[ ! -f "$PDF" ]]; then
  echo "FAIL: Tutorial PDF missing at:"
  echo "  $PDF"
  echo ""
  echo "Regenerate it:  bash scripts/regen-tutorial-pdf.sh"
  exit 1
fi

PDF_MTIME=$(stat -c "%Y" "$PDF" 2>/dev/null || stat -f "%m" "$PDF")
STALE_FILES=()

for src in "${SOURCES[@]}"; do
  [[ -f "$src" ]] || continue
  SRC_MTIME=$(stat -c "%Y" "$src" 2>/dev/null || stat -f "%m" "$src")
  if (( SRC_MTIME > PDF_MTIME )); then
    STALE_FILES+=("$(basename "$src")")
  fi
done

# ── Report ─────────────────────────────────────────────────────────────────
if (( ${#STALE_FILES[@]} > 0 )); then
  echo "FAIL: Tutorial PDF is stale — these source files are newer than the PDF:"
  for f in "${STALE_FILES[@]}"; do
    echo "  - $f"
  done
  echo ""
  echo "To regenerate (dev server must be running on :8080):"
  echo "  bash scripts/regen-tutorial-pdf.sh"
  exit 1
fi

echo "OK: Tutorial PDF is up to date."
exit 0
