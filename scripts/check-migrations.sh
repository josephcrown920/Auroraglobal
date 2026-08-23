#!/usr/bin/env bash
# check-migrations.sh — catch migration filename problems before they hit
# `supabase db push` against a shared database.
#
# This is a local, DB-less structural check (safe for CI): it does not
# require SUPABASE_DB_PASSWORD or network access. It catches the two
# concrete failure modes we've hit in practice:
#   1. Two migration files sharing the same leading timestamp ("version").
#      Supabase's migration ledger primary-keys on that timestamp, so a
#      collision means one of the two files silently never gets recorded
#      as applied (see docs/DB_MIGRATIONS.md).
#   2. A filename that doesn't match the expected
#      `YYYYMMDDHHMMSS_slug.sql` convention, which breaks version parsing.
set -euo pipefail
cd "$(dirname "$0")/.."

MIGRATIONS_DIR="supabase/migrations"

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "ERROR: $MIGRATIONS_DIR does not exist." >&2
  exit 2
fi

status=0

# --- 1. Filename format ---
bad_names="$(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' \
  | grep -vE '^[0-9]{14}_[a-zA-Z0-9_.-]+\.sql$' || true)"
if [[ -n "$bad_names" ]]; then
  echo "ERROR: migration filenames that don't match YYYYMMDDHHMMSS_slug.sql:" >&2
  echo "$bad_names" | sed 's/^/  - /' >&2
  status=1
fi

# --- 2. Timestamp collisions ---
dupes="$(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' \
  | sed -E 's/^([0-9]{14})_.*/\1/' | sort | uniq -d || true)"
if [[ -n "$dupes" ]]; then
  echo "ERROR: duplicate migration timestamps (each must be unique):" >&2
  for ts in $dupes; do
    find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name "${ts}_*.sql" -printf '  - %f\n' >&2
  done
  echo "Fix: rename one file to a nearby-but-unique timestamp. If the" >&2
  echo "colliding version is already applied live, also insert its new" >&2
  echo "version into supabase_migrations.schema_migrations (see" >&2
  echo "docs/DB_MIGRATIONS.md)." >&2
  status=1
fi

if [[ "$status" -eq 0 ]]; then
  count="$(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' | wc -l)"
  echo "OK: $count migration files, no filename or timestamp collisions."
fi

exit "$status"
