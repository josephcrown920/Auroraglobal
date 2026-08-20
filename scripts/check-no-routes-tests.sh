#!/usr/bin/env bash
set -euo pipefail

# TanStack Start treats every file in src/routes/ as a route. Keep test and
# spec files out of that tree so they cannot accidentally become app routes.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROUTES_DIR="$ROOT/src/routes"

matches="$(find "$ROUTES_DIR" -type f \( -name '*.test.*' -o -name '*.spec.*' \) -print)"

if [[ -n "$matches" ]]; then
  printf 'ERROR: test/spec files found in src/routes/:\n%s\n' "$matches" >&2
  exit 1
fi