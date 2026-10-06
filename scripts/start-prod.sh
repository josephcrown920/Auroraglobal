#!/usr/bin/env bash
# Onion layer 3: start-time boot-restore guard (see docs/BACKUP_AND_DR.md).
# This is the production RUN command (artifacts/web artifact.toml
# [services.production].run delegates here).
#
# Instead of blindly exec-ing .output, this guard:
#   1. sanity-checks the current build output (server entry exists),
#   2. boot-probes it on a scratch port (scripts/health-gate.mjs),
#   3. serves it only if the probe passes,
#   4. otherwise LOUDLY falls back to the last-known-good snapshot and serves
#      that instead — the site comes back up instead of crash-looping,
#   5. exits non-zero only when neither the current build nor the snapshot
#      can serve (nothing safe left to try).
#
# Env knobs (used by the recovery drill; production uses defaults):
#   AURORA_BUILD_OUTPUT     build dir to prefer        (default .output)
#   AURORA_SNAPSHOT_DIR     snapshot root              (default .build-snapshots)
#   AURORA_PROBE_PORT       scratch port for boot probe (default: freshly
#                           allocated ephemeral port — see health-gate.mjs)
#   AURORA_PROBE_TIMEOUT_S  probe timeout               (default 60)
#   AURORA_HEALTH_PATH      health endpoint path        (default /api/health)
#   AURORA_START_SKIP_PROBE=1 skips boot probes (emergency escape hatch only)
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

OUTPUT_DIR="${AURORA_BUILD_OUTPUT:-$ROOT/.output}"
SNAP_ROOT="${AURORA_SNAPSHOT_DIR:-$ROOT/.build-snapshots}"
PORT="${PORT:-8080}"
HOST="${HOST:-0.0.0.0}"
PROBE_PORT="${AURORA_PROBE_PORT:-}"
PROBE_TIMEOUT="${AURORA_PROBE_TIMEOUT_S:-60}"
HEALTH_PATH="${AURORA_HEALTH_PATH:-/api/health}"
# Runtime heap cap — keep in sync with artifact.toml's run env and the build
# heap cap (docs/BACKUP_AND_DR.md).
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4608}"
export PORT HOST

boot_ok() { # $1 = build dir
  local dir="$1"
  if [ ! -f "$dir/server/index.mjs" ]; then
    echo "[start] $dir: missing server/index.mjs — build output is missing or incomplete" >&2
    return 1
  fi
  if [ "${AURORA_START_SKIP_PROBE:-0}" = "1" ]; then
    echo "[start] WARNING: boot probe skipped via AURORA_START_SKIP_PROBE=1 for $dir" >&2
    return 0
  fi
  local port_args=()
  [ -n "$PROBE_PORT" ] && port_args=(--port "$PROBE_PORT")
  bash scripts/replit-node.sh scripts/health-gate.mjs \
    --build-dir "$dir" "${port_args[@]+"${port_args[@]}"}" \
    --timeout-s "$PROBE_TIMEOUT" --health-path "$HEALTH_PATH"
}

serve() { # $1 = build dir (never returns — replaces this process)
  echo "[start] serving $1 on $HOST:$PORT (NODE_OPTIONS=$NODE_OPTIONS)"
  exec bash scripts/replit-node.sh "$1/server/index.mjs"
}

if boot_ok "$OUTPUT_DIR"; then
  serve "$OUTPUT_DIR"
fi

echo "[start] ****************************************************************" >&2
echo "[start] CURRENT BUILD FAILED ITS BOOT PROBE — auto-restoring the last-known-good snapshot" >&2
echo "[start] ****************************************************************" >&2

LKG_DIR="$SNAP_ROOT/last-known-good"
if [ -e "$LKG_DIR/server/index.mjs" ]; then
  if boot_ok "$LKG_DIR"; then
    echo "[start] last-known-good snapshot passed its boot probe; serving it instead of the broken build" >&2
    serve "$LKG_DIR"
  fi
  echo "[start] last-known-good snapshot ALSO failed its boot probe" >&2
else
  echo "[start] no last-known-good snapshot exists at $LKG_DIR" >&2
fi

echo "[start] FATAL: neither the current build nor the last-known-good snapshot can serve. The site is DOWN." >&2
exit 1
