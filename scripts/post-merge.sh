#!/usr/bin/env bash
# Post-merge hook for this project.
#
# Intentionally a safe no-op. The live web app ("Aurora") lives at the repo
# ROOT and is Bun-managed; the Expo mobile app under artifacts/ is pnpm-managed.
# We deliberately do NOT run database migrations, `db push`, or any installs
# here, because an automatic reconcile could break the Bun web app or mutate
# the production database.
set -euo pipefail
echo "post-merge: no reconciliation steps configured (safe no-op)."
