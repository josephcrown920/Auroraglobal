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
#   POST /api/public/free-daily-grant    once per UTC day — +4 Aura to every user
#                                                        (idempotent; retried each
#                                                        tick until it succeeds)
#   POST /api/public/lifecycle-emails   every 6 h    — sends deduplicated
#                                                        lifecycle + engagement emails
#   POST /api/public/deletion-sweep      every 1 h    — retries failed account-
#                                                        deletion final sweeps
#                                                        until the purge completes
#
# Auth: public Supabase key for ordinary maintenance endpoints, plus the
# private INTER_APP_API_KEY for the account-deletion sweep.
# App:  localhost:8080 (same container as this daemon).

set -euo pipefail

APP="http://localhost:8080"
TICK_INTERVAL=60       # seconds between job-queue ticks
HEALTH_INTERVAL=300      # seconds between worker health checks
BALANCE_INTERVAL=21600   # seconds between API balance checks (6 hours)
SWEEP_INTERVAL=21600     # seconds between stuck-payment sweeps (6 hours)
DELSWEEP_INTERVAL=3600   # seconds between account-deletion sweep retries (1 hour)
MODELWATCH_INTERVAL=21600  # seconds between new-AI-model catalog scans (6 hours)
GENHEALTH_INTERVAL=900     # seconds between generation health checks (15 min)
LIFECYCLE_INTERVAL=21600   # seconds between lifecycle email runs (6 hours)

# ── Auth key ────────────────────────────────────────────────────────────────
APIKEY="${CRON_SECRET:-${SUPABASE_PUBLISHABLE_KEY:-${SUPABASE_ANON_KEY:-}}}"
if [ -z "$APIKEY" ]; then
  echo "[cron] ERROR: no auth key found. Set SUPABASE_PUBLISHABLE_KEY or CRON_SECRET." >&2
  exit 1
fi
DELETION_SWEEP_KEY="${INTER_APP_API_KEY:-}"
if [ -z "$DELETION_SWEEP_KEY" ]; then
  echo "[cron] ERROR: INTER_APP_API_KEY is required for the deletion sweep." >&2
  exit 1
fi

echo "[cron] starting — tick every ${TICK_INTERVAL}s, health every ${HEALTH_INTERVAL}s"
echo "[cron] app: $APP"

# ── GitHub sync daemon (companion process) ──────────────────────────────────
# The workspace is at its managed-workflow limit, so the github-sync daemon
# rides along inside this long-lived cron workflow instead of owning its own.
# The daemon self-guards: non-main REPL_IDs idle forever (it never pushes from
# task-agent clones), so launching it unconditionally here is safe everywhere.
# It dies with this workflow (child process) and is relaunched on cron restart.
GH_SYNC_SCRIPT="$(dirname "$0")/github-sync-daemon.sh"
if [ -f "$GH_SYNC_SCRIPT" ] && ! pgrep -f "github-sync-daemon.sh" >/dev/null 2>&1; then
  bash "$GH_SYNC_SCRIPT" &
  echo "[cron] launched github-sync daemon (pid $!)"
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
last_delsweep=0
last_modelwatch=0
last_genhealth=0
last_lifecycle=0
last_vast=0
last_ghsync=0
last_grant_day=""

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

  # Account-deletion sweep retry (every hour). Drains account_deletion_sweeps:
  # deletions whose post-auth final cleanup failed get their storage+row purge
  # re-run until it succeeds (the login is already gone, so only this daemon
  # can finish the job).
  if [ $((now - last_delsweep)) -ge $DELSWEEP_INTERVAL ]; then
    resp=$(curl -sf "$APP/api/public/deletion-sweep" \
      -X POST \
      -H "x-aurora-internal-key: $DELETION_SWEEP_KEY" \
      -H "content-type: application/json" \
      --max-time 55 2>&1) && rc=0 || rc=$?
    ts=$(date -u +"%H:%M:%S")
    if [ $rc -eq 0 ]; then
      echo "[$ts][deletion-sweep] OK — $resp"
    else
      echo "[$ts][deletion-sweep] WARN — $resp (rc=$rc)"
    fi
    last_delsweep=$now
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

  # Daily Aura grant (once per UTC calendar day) — +4 Aura to every user.
  # The endpoint is idempotent (unique daily ledger ref), so we only mark the
  # day done on success; failures retry on the next 60 s tick.
  today=$(date -u +%F)
  if [ "$today" != "$last_grant_day" ]; then
    resp=$(curl -sf "$APP/api/public/free-daily-grant" \
      -X POST \
      -H "apikey: $APIKEY" \
      -H "content-type: application/json" \
      --max-time 60 2>&1) && rc=0 || rc=$?
    ts=$(date -u +"%H:%M:%S")
    if [ $rc -eq 0 ]; then
      echo "[$ts][daily-grant] OK — $resp"
      last_grant_day=$today
    else
      echo "[$ts][daily-grant] WARN — $resp (rc=$rc)"
    fi
  fi

  # Lifecycle + engagement emails (every 6 hours).
  # The endpoint deduplicates each template via email_log and only sends
  # candidates inside each template's own cooldown/window.
  if [ $((now - last_lifecycle)) -ge $LIFECYCLE_INTERVAL ]; then
    resp=$(curl -sf "$APP/api/public/lifecycle-emails" \
      -X POST \
      -H "apikey: $APIKEY" \
      -H "content-type: application/json" \
      --max-time 300 2>&1) && rc=0 || rc=$?
    ts=$(date -u +"%H:%M:%S")
    if [ $rc -eq 0 ]; then
      echo "[$ts][lifecycle-emails] OK — $resp"
    else
      echo "[$ts][lifecycle-emails] WARN — $resp (rc=$rc)"
    fi
    last_lifecycle=$now
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

  # GitHub sync monitor (every 5 min, piggybacks on the health cadence).
  # Reads the github-sync daemon's local status file and emails the operator
  # (via Resend) once the sync has been broken for over an hour; sends a
  # recovery email when it comes back. Dedup state: uptime_monitor_state
  # row id='github_sync'.
  if [ $((now - last_ghsync)) -ge $HEALTH_INTERVAL ]; then
    resp=$(curl -sf "$APP/api/public/github-sync-monitor" \
      -X POST \
      -H "apikey: $APIKEY" \
      -H "content-type: application/json" \
      --max-time 30 2>&1) && rc=0 || rc=$?
    ts=$(date -u +"%H:%M:%S")
    if [ $rc -eq 0 ]; then
      echo "[$ts][gh-sync] OK — $resp"
    else
      echo "[$ts][gh-sync] WARN — $resp (rc=$rc)"
    fi
    last_ghsync=$now
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
