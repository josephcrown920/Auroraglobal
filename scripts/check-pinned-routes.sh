#!/usr/bin/env bash
# check-pinned-routes.sh — smoke-checks the three bottom-tab flagship routes.
#
# Accepts only HTTP 200 as success. Any 4xx, 5xx, redirect, or connection
# failure is treated as a failure and the script exits non-zero.
#
# Usage: bash scripts/check-pinned-routes.sh [base_url]
#   base_url defaults to http://localhost:8080

set -uo pipefail

BASE="${1:-http://localhost:8080}"
FAILED=0

check_route() {
  local path="$1"
  local url="${BASE}${path}"
  local http_code

  # -L would follow redirects and hide auth-guard redirects (e.g. /auth) —
  # intentionally NOT used so a 3xx is surfaced as a failure.
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null) || {
    echo "FAIL  $path  →  connection failed (server not running or timed out)"
    FAILED=1
    return
  }

  if [[ -z "$http_code" || "$http_code" == "000" ]]; then
    echo "FAIL  $path  →  no response (server not running?)"
    FAILED=1
  elif [[ "$http_code" -eq 200 ]]; then
    echo "OK    $path  →  HTTP 200"
  else
    # 3xx = auth-guard redirect (means the route is SSR-broken or misconfigured)
    # 4xx = missing route (404) or auth-only without SSR rendering a shell
    # 5xx = server crash
    echo "FAIL  $path  →  HTTP $http_code (expected 200)"
    FAILED=1
  fi
}

echo "Checking pinned bottom-tab routes against ${BASE}..."
check_route "/video-agent"
check_route "/canvas"
check_route "/spin"

if [[ $FAILED -ne 0 ]]; then
  echo ""
  echo "One or more pinned routes did not return HTTP 200."
  echo "Common causes: SSR error (500), missing route (404), auth-guard redirect (3xx)."
  echo "Check the dev-server log for details."
  exit 1
fi

echo ""
echo "All pinned routes returned HTTP 200."
