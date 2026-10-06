#!/usr/bin/env bash
# Onion layer 4: rotating local git backup refs (see docs/BACKUP_AND_DR.md).
#
# Creates/updates dated refs pointing at the current Main tip:
#   backup/YYYY-MM-DD          daily,   last 14 kept
#   backup/monthly/YYYY-MM     monthly, last 12 kept
# so recent source states are always recoverable in-workspace even after a
# bad rebase / force-push / accidental reset — on top of the GitHub mirror
# (which covers losing the workspace itself).
#
# These refs stay LOCAL on purpose: the published GitHub lineage has >=100MB
# blobs stripped (scripts/github-autopush.sh), so pushing raw workspace refs
# would be rejected. The mirror protects Main; these refs protect recent
# points ON Main inside the workspace.
#
# Runs daily from scripts/github-sync-daemon.sh (rides the cron workflow).
# Only the primary workspace maintains backup refs; task-agent clones skip
# (same guard as the sync daemon). AURORA_BACKUP_REFS_FORCE=1 overrides the
# guard for the automated drill/tests.
set -euo pipefail

MAIN_REPL_ID="70e0e8ce-1ee1-49b1-8d1e-35dc6c558d3d"
if [[ "${AURORA_BACKUP_REFS_FORCE:-0}" != "1" && "${REPL_ID:-}" != "$MAIN_REPL_ID" ]]; then
  echo "[backup-refs] not the main workspace (REPL_ID=${REPL_ID:-unset}); skipping."
  exit 0
fi

# AURORA_BACKUP_REFS_REPO overrides the repo dir (used by the drill/tests,
# which run against a throwaway git repo).
ROOT="${AURORA_BACKUP_REFS_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$ROOT"

TODAY="${AURORA_BACKUP_DATE:-$(date -u +%F)}" # override exists for tests
if [[ ! "$TODAY" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "[backup-refs] ERROR: invalid date '$TODAY' (want YYYY-MM-DD)" >&2
  exit 1
fi
MONTH="${TODAY:0:7}"
DAILY_KEEP="${AURORA_BACKUP_DAILY_KEEP:-14}"
MONTHLY_KEEP="${AURORA_BACKUP_MONTHLY_KEEP:-12}"

TARGET="$(git rev-parse --verify Main 2>/dev/null || git rev-parse --verify HEAD)"

git update-ref "refs/heads/backup/$TODAY" "$TARGET"
git update-ref "refs/heads/backup/monthly/$MONTH" "$TARGET"
echo "[backup-refs] backup/$TODAY and backup/monthly/$MONTH -> ${TARGET:0:12}"

# Rotate: date-named refs sort lexicographically, oldest first.
rotate() { # $1 = ref glob, $2 = keep count
  local pattern="$1" keep="$2"
  git for-each-ref --format='%(refname)' "$pattern" | sort | head -n -"$keep" | while read -r ref; do
    git update-ref -d "$ref"
    echo "[backup-refs] rotated out ${ref#refs/heads/}"
  done
}
rotate "refs/heads/backup/2*" "$DAILY_KEEP"
rotate "refs/heads/backup/monthly/*" "$MONTHLY_KEEP"
