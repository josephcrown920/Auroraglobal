#!/usr/bin/env bash
# Background daemon that keeps the GitHub mirror (Auroraglobal) in sync with
# every new commit landed on this workspace's Main branch.
#
# Why polling instead of a git hook:
#   Replit's checkpoint/commit mechanism is not guaranteed to invoke porcelain
#   git hooks (post-commit etc. only fire for `git commit`, not plumbing-level
#   commit creation some automated systems use). Polling `git rev-parse Main`
#   is cheap and 100% reliable regardless of how the commit was made.
#
# What it does each cycle:
#   1. Compares the current tip of Main to the last SHA it successfully synced
#      (tracked in a local, untracked state file).
#   2. If it changed, runs scripts/github-autopush.sh, which strips oversized
#      blobs and force-updates the GitHub repos' Main to match.
#   3. Records the new SHA only on success, so a failed push is retried next
#      cycle instead of being silently marked "done".
#   4. On auth failures (invalid/expired token) it backs off exponentially
#      (up to 30 minutes) to avoid hammering disk with expensive workspace
#      clones on every cycle when the token is known-broken.
#
# This script is meant to run under a long-lived workflow (see the
# "github-sync" workflow), not as a one-off command.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STATE_FILE="$ROOT/.local/.github-sync-last-sha"
INTERVAL_SECONDS="${GITHUB_SYNC_INTERVAL_SECONDS:-30}"
mkdir -p "$(dirname "$STATE_FILE")"

echo "[github-sync] daemon starting (poll every ${INTERVAL_SECONDS}s)"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "[github-sync] WARNING: GITHUB_TOKEN is not set yet. Waiting for it to" \
       "appear (set the secret and this daemon will pick it up automatically)."
fi

# Exponential backoff state for auth failures.
# When the token is invalid we back off up to AUTH_BACKOFF_MAX_SECONDS to avoid
# cloning the entire workspace on every 30-second cycle for no reason.
AUTH_BACKOFF_SECONDS=0
AUTH_BACKOFF_MAX_SECONDS=1800  # 30 minutes

quick_auth_check() {
  local owner="josephcrown920"
  local repo="Auroraglobal"
  local token="${GITHUB_TOKEN:-}"
  [[ -z "$token" ]] && return 1
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: token $token" \
    "https://api.github.com/repos/${owner}/${repo}" \
    --max-time 10)
  [[ "$http_code" == "200" ]]
}

while true; do
  CURRENT_SHA="$(git rev-parse Main 2>/dev/null || true)"
  LAST_SHA=""
  [[ -f "$STATE_FILE" ]] && LAST_SHA="$(cat "$STATE_FILE" 2>/dev/null || true)"

  if [[ -n "$CURRENT_SHA" && "$CURRENT_SHA" != "$LAST_SHA" ]]; then
    if [[ -z "${GITHUB_TOKEN:-}" ]]; then
      echo "[github-sync] $(date -u +%FT%TZ) new commit ${CURRENT_SHA} detected but GITHUB_TOKEN is unset; skipping until it is configured."
    elif [[ "$AUTH_BACKOFF_SECONDS" -gt 0 ]]; then
      echo "[github-sync] $(date -u +%FT%TZ) auth backoff active (${AUTH_BACKOFF_SECONDS}s remaining); skipping clone"
      AUTH_BACKOFF_SECONDS=$(( AUTH_BACKOFF_SECONDS - INTERVAL_SECONDS ))
      [[ "$AUTH_BACKOFF_SECONDS" -lt 0 ]] && AUTH_BACKOFF_SECONDS=0
    else
      # Quick lightweight auth check before the expensive workspace clone
      if ! quick_auth_check; then
        AUTH_BACKOFF_SECONDS=300  # start at 5 minutes
        echo "[github-sync] $(date -u +%FT%TZ) GitHub auth failed (token invalid or expired); backing off ${AUTH_BACKOFF_SECONDS}s — update the GITHUB_TOKEN secret to resume sync" >&2
      else
        echo "[github-sync] $(date -u +%FT%TZ) new commit ${CURRENT_SHA} detected (was ${LAST_SHA:-none}); syncing to GitHub..."
        PUSH_OUT=$(bash "$ROOT/scripts/github-autopush.sh" 2>&1) && PUSH_OK=true || PUSH_OK=false
        if $PUSH_OK; then
          echo "$CURRENT_SHA" > "$STATE_FILE"
          echo "[github-sync] $(date -u +%FT%TZ) sync OK -> ${CURRENT_SHA}"
          AUTH_BACKOFF_SECONDS=0
        else
          echo "$PUSH_OUT" >&2
          if echo "$PUSH_OUT" | grep -q "Invalid username or token\|Authentication failed\|403\|401"; then
            # Double backoff up to max
            AUTH_BACKOFF_SECONDS=$(( AUTH_BACKOFF_SECONDS == 0 ? 300 : AUTH_BACKOFF_SECONDS * 2 ))
            [[ "$AUTH_BACKOFF_SECONDS" -gt "$AUTH_BACKOFF_MAX_SECONDS" ]] && AUTH_BACKOFF_SECONDS=$AUTH_BACKOFF_MAX_SECONDS
            echo "[github-sync] $(date -u +%FT%TZ) auth error detected; backing off ${AUTH_BACKOFF_SECONDS}s" >&2
          else
            echo "[github-sync] $(date -u +%FT%TZ) sync FAILED for ${CURRENT_SHA}; will retry next cycle" >&2
          fi
        fi
      fi
    fi
  fi

  sleep "$INTERVAL_SECONDS"
done
