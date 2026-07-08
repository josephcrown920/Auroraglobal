#!/usr/bin/env bash
# Aurora built-in cron daemon.
# Replaces the Supabase dashboard pg_cron requirement so generation jobs drain
# and GPU worker health is checked entirely within Replit — no external scheduler.
#
# Calls:
#   POST /api/public/jobs/tick   every 60 s  — drains the job queue
#   POST /api/public/workers/health  every 5 min — flips active/paused workers
#
# Auth: SUPABASE_PUBLISHABLE_KEY (already in env).
# App:  localhost:8080 (same container as this daemon).

set -euo pipefail

APP="http://localhost:8080"
TICK_INTERVAL=60       # seconds between job-queue ticks
HEALTH_INTERVAL=300    # seconds between worker health checks

# ── Auth key ────────────────────────────────────────────────────────────────
APIKEY="${SUPABASE_PUBLISHABLE_KEY:-${SUPABASE_ANON_KEY:-${CRON_SECRET:-}}}"
if [ -z "$APIKEY" ]; then
  echo "[cron] ERROR: no auth key found. Set SUPABASE_PUBLISHABLE_KEY or CRON_SECRET." >&2
  exit 1
fi

echo "[cron] starting — tick every ${TICK_INTERVAL}s, health every ${HEALTH_INTERVAL}s"
echo "[cron] app: $APP"

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

  sleep $TICK_INTERVAL
done
