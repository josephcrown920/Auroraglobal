#!/usr/bin/env bash
# Recovery drill (onion layer 5, see docs/BACKUP_AND_DR.md).
#
# Proves the auto-restore path actually works, end to end, in a sandboxed
# scratch copy — without touching the real build or snapshots:
#   case 1: broken current build  -> start-prod.sh must auto-restore and
#            serve the last-known-good snapshot (and log the fallback loudly)
#   case 2: healthy current build -> start-prod.sh must serve it directly,
#            no fallback
#   case 3: both broken           -> start-prod.sh must fail loudly, not hang
#            or serve something unprobed
#
# The "builds" are tiny fake Node servers with the real build layout
# (server/index.mjs + /api/health), so the drill exercises the REAL guard
# (scripts/start-prod.sh + scripts/health-gate.mjs) in seconds.
#
# Run on demand:  bash scripts/dr-recovery-drill.sh
# Also runs in CI via src/lib/recovery/dr-layers.test.ts (bun test src/).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SCRATCH="$(mktemp -d /tmp/aurora-drill.XXXXXX)"
SERVER_PID=""
cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
  rm -rf "$SCRATCH"
}
trap cleanup EXIT

pick_port() {
  python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()'
}

# $1 = build dir, $2 = marker string served on /
make_fake_build() {
  mkdir -p "$1/server" "$1/public"
  cat > "$1/server/index.mjs" <<'EOF'
import http from "node:http";
const port = Number(process.env.PORT || "3000");
const host = process.env.HOST || "127.0.0.1";
http
  .createServer((req, res) => {
    if (req.url === "/api/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, uptime_s: 1 }));
      return;
    }
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("SERVED-BY:__MARKER__");
  })
  .listen(port, host);
EOF
  sed -i "s/__MARKER__/$2/" "$1/server/index.mjs"
}

# $1 = build dir, $2 = exit code the "server" should die with
make_broken_build() {
  mkdir -p "$1/server" "$1/public"
  echo "process.exit($2);" > "$1/server/index.mjs"
}

# wait up to 15s for a 200 from the given port, print the body
wait_served() { # $1 = port
  local i
  for i in $(seq 1 30); do
    body="$(curl -sf --max-time 2 "http://127.0.0.1:$1/" 2>/dev/null)" && { echo "$body"; return 0; }
    sleep 0.5
  done
  return 1
}

FAILURES=0
note()  { echo "[drill] $*"; }
check() { # $1 = description, $2 = 0/1 result
  if [ "$2" = "0" ]; then note "PASS: $1"; else note "FAIL: $1"; FAILURES=$((FAILURES + 1)); fi
}

SNAP="$SCRATCH/.build-snapshots"
mkdir -p "$SNAP/snapshots"
make_fake_build "$SNAP/snapshots/20000101-000000z-drill" "LKG-BUILD"
ln -s "snapshots/20000101-000000z-drill" "$SNAP/last-known-good"
note "scratch: $SCRATCH (last-known-good snapshot in place)"

# ── Case 1: broken current build -> auto-restore serves last-known-good ──────
make_broken_build "$SCRATCH/.output" 1
P_SERVE="$(pick_port)"; P_PROBE="$(pick_port)"
note "case 1: broken current build (serve :$P_SERVE, probe :$P_PROBE)"
AURORA_BUILD_OUTPUT="$SCRATCH/.output" AURORA_SNAPSHOT_DIR="$SNAP" \
  PORT="$P_SERVE" AURORA_PROBE_PORT="$P_PROBE" AURORA_PROBE_TIMEOUT_S=15 HOST=127.0.0.1 \
  bash scripts/start-prod.sh > "$SCRATCH/case1.log" 2>&1 &
SERVER_PID=$!
BODY="$(wait_served "$P_SERVE")" && RC1=0 || RC1=1
[ "$RC1" = "0" ] && [ "$BODY" = "SERVED-BY:LKG-BUILD" ] && RC1=0 || RC1=1
check "broken current build auto-restores to last-known-good" "$RC1"
kill "$SERVER_PID" 2>/dev/null; wait "$SERVER_PID" 2>/dev/null; SERVER_PID=""
grep -q "auto-restoring the last-known-good snapshot" "$SCRATCH/case1.log"; RC1B=$?
check "fallback is logged loudly" "$RC1B"

# ── Case 2: healthy current build -> served directly, no fallback ────────────
rm -rf "$SCRATCH/.output"
make_fake_build "$SCRATCH/.output" "CURRENT-BUILD"
# Case 2 omits AURORA_PROBE_PORT on purpose: the production path lets the
# gate freshly allocate its probe port, so the drill covers that path too.
P_SERVE="$(pick_port)"
note "case 2: healthy current build (serve :$P_SERVE, dynamically allocated probe port)"
AURORA_BUILD_OUTPUT="$SCRATCH/.output" AURORA_SNAPSHOT_DIR="$SNAP" \
  PORT="$P_SERVE" AURORA_PROBE_TIMEOUT_S=15 HOST=127.0.0.1 \
  bash scripts/start-prod.sh > "$SCRATCH/case2.log" 2>&1 &
SERVER_PID=$!
BODY="$(wait_served "$P_SERVE")" && RC2=0 || RC2=1
[ "$RC2" = "0" ] && [ "$BODY" = "SERVED-BY:CURRENT-BUILD" ] && RC2=0 || RC2=1
check "healthy current build is served directly" "$RC2"
kill "$SERVER_PID" 2>/dev/null; wait "$SERVER_PID" 2>/dev/null; SERVER_PID=""
grep -q "auto-restoring" "$SCRATCH/case2.log" && RC2B=1 || RC2B=0
check "no fallback logged for a healthy build" "$RC2B"

# ── Case 3: current AND last-known-good broken -> loud failure, no hang ──────
rm -rf "$SCRATCH/.output"
make_broken_build "$SCRATCH/.output" 1
rm -rf "$SNAP/snapshots/20000101-000000z-drill"
make_broken_build "$SNAP/snapshots/20000101-000000z-drill" 1
P_SERVE="$(pick_port)"; P_PROBE="$(pick_port)"
note "case 3: both broken (probe :$P_PROBE)"
AURORA_BUILD_OUTPUT="$SCRATCH/.output" AURORA_SNAPSHOT_DIR="$SNAP" \
  PORT="$P_SERVE" AURORA_PROBE_PORT="$P_PROBE" AURORA_PROBE_TIMEOUT_S=10 HOST=127.0.0.1 \
  timeout 120 bash scripts/start-prod.sh > "$SCRATCH/case3.log" 2>&1
RC3=$?
[ "$RC3" != "0" ] && [ "$RC3" != "124" ] && RC3OK=0 || RC3OK=1
check "both-broken exits non-zero (not a timeout/hang)" "$RC3OK"
grep -q "The site is DOWN" "$SCRATCH/case3.log"; RC3B=$?
check "both-broken logs a loud FATAL" "$RC3B"

echo
if [ "$FAILURES" = "0" ]; then
  note "DRILL PASS — auto-restore from last-known-good is proven working."
  exit 0
fi
note "DRILL FAIL — $FAILURES check(s) failed. Logs in $SCRATCH are removed on exit; re-run with bash -x for detail."
exit 1
