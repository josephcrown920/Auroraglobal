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
MODELWATCH_INTERVAL=21600  # seconds between new-AI-model catalog scans (6 hours)
GENHEALTH_INTERVAL=900     # seconds between generation health checks (15 min)

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
last_balance=0
last_sweep=0
last_modelwatch=0
last_genhealth=0
last_vast=0

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

  # Generation health check (every 15 min) — alerts when image/video/lipsync
  # error rate crosses the threshold or a kind produces zero successes.
  if [ $((now - last_genhealth)) -ge $GENHEALTH_INTERVAL ]; then
    resp=$(curl -sf "$APP/api/public/provider-health-check" \
      -X POST \
      -H "apikey: $APIKEY" \
      -H "content-type: application/json" \
      --max-time 30 2>&1) && rc=0 || rc=$?
    ts=$(date -u +"%H:%M:%S")
    if [ $rc -eq 0 ]; then
      echo "[$ts][gen-health] OK — $resp"
    else
      echo "[$ts][gen-health] WARN — $resp (rc=$rc)"
    fi
    last_genhealth=$now
  fi

  # Vast managed-instance expiry (every 5 min, piggybacks on the health cadence).
  # Destroys Aurora-managed Vast rentals past their 1-hour deadline; retry-safe.
  if [ $((now - last_vast)) -ge $HEALTH_INTERVAL ]; then
    resp=$(curl -sf "$APP/api/public/vast/expire" \
      -X POST \
      -H "apikey: $APIKEY" \
      -H "content-type: application/json" \
      --max-time 60 2>&1) && rc=0 || rc=$?
    ts=$(date -u +"%H:%M:%S")
    if [ $rc -eq 0 ]; then
      echo "[$ts][vast-expire] OK — $resp"
    else
      echo "[$ts][vast-expire] WARN — $resp (rc=$rc)"
    fi
    last_vast=$now
  fi

  # Model watch — new-AI-model discovery scan (every 6 hours).
  # Scans fal.ai + Replicate catalogs for unseen models and probes the
  # anticipated ModelArk slugs (e.g. Seedance 2.5); emails the operator
  # when something genuinely new shows up.
  if [ $((now - last_modelwatch)) -ge $MODELWATCH_INTERVAL ]; then
    resp=$(curl -sf "$APP/api/public/model-watch" \
      -X GET \
      -H "apikey: $APIKEY" \
      --max-time 120 2>&1) && rc=0 || rc=$?
    ts=$(date -u +"%H:%M:%S")
    if [ $rc -eq 0 ]; then
      echo "[$ts][model-watch] OK — $resp"
    else
      echo "[$ts][model-watch] WARN — $resp (rc=$rc)"
    fi
    last_modelwatch=$now
  fi

  sleep $TICK_INTERVAL
done
