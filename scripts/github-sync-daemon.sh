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

while true; do
  CURRENT_SHA="$(git rev-parse Main 2>/dev/null || true)"
  LAST_SHA=""
  [[ -f "$STATE_FILE" ]] && LAST_SHA="$(cat "$STATE_FILE" 2>/dev/null || true)"

  if [[ -n "$CURRENT_SHA" && "$CURRENT_SHA" != "$LAST_SHA" ]]; then
    if [[ -z "${GITHUB_TOKEN:-}" ]]; then
      echo "[github-sync] $(date -u +%FT%TZ) new commit ${CURRENT_SHA} detected but GITHUB_TOKEN is unset; skipping until it is configured."
    else
      echo "[github-sync] $(date -u +%FT%TZ) new commit ${CURRENT_SHA} detected (was ${LAST_SHA:-none}); syncing to GitHub..."
      if bash "$ROOT/scripts/github-autopush.sh"; then
        echo "$CURRENT_SHA" > "$STATE_FILE"
        echo "[github-sync] $(date -u +%FT%TZ) sync OK -> ${CURRENT_SHA}"
      else
        echo "[github-sync] $(date -u +%FT%TZ) sync FAILED for ${CURRENT_SHA}; will retry next cycle" >&2
      fi
    fi
  fi

  sleep "$INTERVAL_SECONDS"
done
