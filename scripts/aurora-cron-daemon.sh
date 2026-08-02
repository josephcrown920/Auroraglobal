#!/usr/bin/env bash
# Aurora built-in cron daemon.
# Replaces the Supabase dashboard pg_cron requirement so generation jobs drain
# and GPU worker health is checked entirely within Replit — no external scheduler.
#
# Calls:
#   POST /api/public/jobs/tick           every 60 s   — drains the job queue
#   POST /api/public/workers/health      every 5 min  — flips active/paused workers
#   GET  /api/public/check-api-balances  every 6 h    — logs provider credit balance
#   POST /api/public/payments/sweep-stuck every 6 h   — alerts on stuck pending payments
#                                                        (Paystack retries exhausted)
#
# Auth: SUPABASE_PUBLISHABLE_KEY (already in env).
# App:  localhost:8080 (same container as this daemon).

set -euo pipefail

APP="http://localhost:8080"
TICK_INTERVAL=60       # seconds between job-queue ticks
HEALTH_INTERVAL=300      # seconds between worker health checks
BALANCE_INTERVAL=21600   # seconds between API balance checks (6 hours)
SWEEP_INTERVAL=21600     # seconds between stuck-payment sweeps (6 hours)

# ── Auth key ────────────────────────────────────────────────────────────────
APIKEY="${SUPABASE_PUBLISHABLE_KEY:-${SUPABASE_ANON_KEY:-${CRON_SECRET:-}}}"
if [ -z "$APIKEY" ]; then
  echo "[cron] ERROR: no auth key found. Set SUPABASE_PUBLISHABLE_KEY or CRON_SECRET." >&2
  exit 1
fi

echo "[cron] starting — tick every ${TICK_INTERVAL}s, health every ${HEALTH_INTERVAL}s"
echo "[cron] app: $APP"

# ── GitHub auto-sync daemon (child process) ────────────────────────────────
# The workspace hit Replit's 10-workflow limit, so the github-sync daemon
# rides along inside this cron workflow instead of having its own. It polls
# Main's SHA every 30s and pushes to GitHub via scripts/github-autopush.sh
# whenever a new commit lands (see scripts/github-sync-daemon.sh).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/github-sync-daemon.sh" ]; then
  bash "$SCRIPT_DIR/github-sync-daemon.sh" 2>&1 | sed 's/^/[github-sync] /' &
  echo "[cron] github-sync daemon launched (pid $!)"
else
  echo "[cron] WARN: github-sync-daemon.sh not found; GitHub auto-sync disabled"
fi

# ── Wait for app to be ready ────────────────────────────────────────────────
for i in $(seq 1 60); do
  if curl -sf "$APP/api/public/workers/health" -o /dev/null \
       -X POST -H "apikey: $APIKEY" -H "content-type: application/json" \
       --max-time 5 2>/dev/null; then
    echo "[cron] app is ready."
    break
  fi
  echo "[cron] waiting for app to start (${i}/60)…"
  sleep 5
done

# ── Main loop ────────────────────────────────────────────────────────────────
last_health=0
last_balance=0
last_sweep=0

while true; do
  now=$(date +%s)

  # Job queue tick
  resp=$(curl -sf "$APP/api/public/jobs/tick" \
    -X POST \
    -H "apikey: $APIKEY" \
    -H "content-type: application/json" \
    --max-time 55 2>&1) && rc=0 || rc=$?
  ts=$(date -u +"%H:%M:%S")
  if [ $rc -eq 0 ]; then
    echo "[$ts][tick] OK — $resp"
  else
    echo "[$ts][tick] WARN — $resp (rc=$rc)"
  fi

  # Production uptime monitor (every 60 s — pings the external SITE_URL/api/health
  # and emails the operator if 2+ consecutive failures; also sends recovery email).
  resp=$(curl -sf "$APP/api/public/uptime-monitor" \
    -X POST \
    -H "apikey: $APIKEY" \
    -H "content-type: application/json" \
    --max-time 25 2>&1) && rc=0 || rc=$?
  ts=$(date -u +"%H:%M:%S")
  if [ $rc -eq 0 ]; then
    echo "[$ts][uptime] OK — $resp"
  else
    echo "[$ts][uptime] WARN — $resp (rc=$rc)"
  fi

  # Worker health (every 5 min)
  if [ $((now - last_health)) -ge $HEALTH_INTERVAL ]; then
    resp=$(curl -sf "$APP/api/public/workers/health" \
      -X POST \
      -H "apikey: $APIKEY" \
      -H "content-type: application/json" \
      --max-time 30 2>&1) && rc=0 || rc=$?
    ts=$(date -u +"%H:%M:%S")
    if [ $rc -eq 0 ]; then
      echo "[$ts][health] OK — $resp"
    else
      echo "[$ts][health] WARN — $resp (rc=$rc)"
    fi
    last_health=$now
  fi

  # API provider balance check (every 6 hours)
  if [ $((now - last_balance)) -ge $BALANCE_INTERVAL ]; then
    resp=$(curl -sf "$APP/api/public/check-api-balances" \
      -X GET \
      -H "apikey: $APIKEY" \
      --max-time 30 2>&1) && rc=0 || rc=$?
    ts=$(date -u +"%H:%M:%S")
    if [ $rc -eq 0 ]; then
      echo "[$ts][balances] OK — $resp"
    else
      echo "[$ts][balances] WARN — $resp (rc=$rc)"
    fi
    last_balance=$now
  fi

  # Stuck-payment sweep (every 6 hours).
  # Finds payments still in "pending" >73 h after creation — these have
  # almost certainly exhausted Paystack's 72-hour retry window.  Each
  # stuck payment is logged as STUCK_PAYMENT so operators can search the
  # deployment logs and intervene manually (Paystack dashboard resend or
  # direct credit grant).
  if [ $((now - last_sweep)) -ge $SWEEP_INTERVAL ]; then
    resp=$(curl -sf "$APP/api/public/payments/sweep-stuck" \
      -X POST \
      -H "apikey: $APIKEY" \
      -H "content-type: application/json" \
      --max-time 30 2>&1) && rc=0 || rc=$?
    ts=$(date -u +"%H:%M:%S")
    if [ $rc -eq 0 ]; then
      echo "[$ts][payments-sweep] OK — $resp"
    else
      echo "[$ts][payments-sweep] WARN — $resp (rc=$rc)"
    fi
    last_sweep=$now
  fi

  sleep $TICK_INTERVAL
done
