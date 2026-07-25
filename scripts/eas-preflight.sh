#!/usr/bin/env bash
# Preflight checks before any EAS mobile build (run from repo root or anywhere).
# Guards against the three lockfile regressions that broke builds in July 2026:
#   1. A stray bun.lock forces the EAS builder to use bun (fails with network errors).
#   2. Root .easignore must not exclude the mobile package-lock.json from the archive.
#   3. Replit's npm writes package-firewall.replit.local URLs into lockfiles;
#      that host is unreachable from EAS builders (npm ci dies with
#      "Exit handler never called!"). Rewrite them to registry.npmjs.org.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE_DIR="$ROOT/artifacts/aurora-mobile"
LOCK="$MOBILE_DIR/package-lock.json"
FAIL=0

# 1. No bun lockfiles anywhere that EAS or the deployer could pick up
FOUND_BUN=$(find "$ROOT" -maxdepth 3 -name 'bun.lock' -o -maxdepth 3 -name 'bun.lockb' 2>/dev/null | grep -v node_modules || true)
if [ -n "$FOUND_BUN" ]; then
  echo "FAIL: bun lockfile(s) present — remote builders will use bun and break:"
  echo "$FOUND_BUN"
  echo "Fix: delete them (npm package-lock.json is authoritative)."
  FAIL=1
fi

# 2. Root .easignore must not exclude the mobile lockfile
if grep -q 'aurora-mobile/package-lock.json' "$ROOT/.easignore" 2>/dev/null; then
  echo "FAIL: root .easignore excludes artifacts/aurora-mobile/package-lock.json — the EAS builder will see 'No lockfile found'."
  FAIL=1
fi

# 3. No Replit firewall URLs in the mobile lockfile (auto-fix)
if [ ! -f "$LOCK" ]; then
  echo "FAIL: $LOCK does not exist."
  FAIL=1
elif grep -q 'package-firewall.replit.local' "$LOCK"; then
  COUNT=$(grep -c 'package-firewall.replit.local' "$LOCK")
  echo "Rewriting $COUNT package-firewall.replit.local URLs to registry.npmjs.org in mobile package-lock.json..."
  sed -i 's|http://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g' "$LOCK"
  node -e "JSON.parse(require('fs').readFileSync('$LOCK','utf8'))" || { echo "FAIL: lockfile invalid JSON after rewrite"; exit 1; }
  echo "Rewrite done (integrity hashes unchanged, still valid)."
fi

if [ "$FAIL" -ne 0 ]; then
  echo "eas-preflight: FAILED — fix the issues above before building."
  exit 1
fi
echo "eas-preflight: OK — safe to run EAS build."
