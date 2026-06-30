#!/usr/bin/env bash
# Auto-push to GitHub every 10 minutes.
# Requires GITHUB_TOKEN secret to be set.

REPO="https://x-access-token:${GITHUB_TOKEN}@github.com/josephcrown920/aurora-charm-forge-87e3e757"
INTERVAL=600  # 10 minutes

echo "[autopush] Starting — will push to GitHub every ${INTERVAL}s"

while true; do
  sleep "$INTERVAL"
  echo "[autopush] $(date -u '+%Y-%m-%d %H:%M:%S UTC') — pushing..."

  # Set authenticated remote, push, then scrub credentials from remote
  git remote set-url origin "$REPO" 2>/dev/null
  if git push origin Main --no-verify 2>&1 | grep -v "x-access-token"; then
    echo "[autopush] Push OK"
  else
    echo "[autopush] Push failed (will retry next cycle)"
  fi
  # Reset remote URL to credential-free version so token never lingers in git config
  git remote set-url origin "https://github.com/josephcrown920/aurora-charm-forge-87e3e757"
done
