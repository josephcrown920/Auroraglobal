#!/usr/bin/env bash
# check-supabase-types.sh — keep src/integrations/supabase/types.ts in sync
# with the LIVE Supabase database schema.
#
# Regenerates the TypeScript DB types from the live database (via the EU
# session pooler — the direct DB host is IPv6-only and unreachable from this
# container) and compares the result against the committed types file.
#
# Usage:
#   bash scripts/check-supabase-types.sh          # check only — exits 1 on drift
#   bash scripts/check-supabase-types.sh --write  # regenerate types.ts in place
#
# Requirements (all fail loudly if missing):
#   - SUPABASE_DB_PASSWORD env var (database password for the pooler user)
#   - SUPABASE_URL env var (project ref is derived from its hostname;
#     supabase/config.toml's project_id is STALE — do not trust it)
set -euo pipefail
cd "$(dirname "$0")/.."

SUPABASE_CLI_VERSION="2.113.0"   # pinned — bump deliberately, output format can shift between versions
TYPES_FILE="src/integrations/supabase/types.ts"
POOLER_HOST="aws-0-eu-west-1.pooler.supabase.com"
POOLER_PORT="6543"

MODE="check"
if [[ "${1:-}" == "--write" ]]; then MODE="write"; fi

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "ERROR: SUPABASE_DB_PASSWORD is not set." >&2
  echo "The Supabase types drift check needs the live DB password to regenerate types." >&2
  echo "Do NOT use SUPABASE_DB_URL — that env value is not a valid PostgreSQL URL." >&2
  exit 2
fi

# Derive the project ref from SUPABASE_URL (e.g. https://<ref>.supabase.co).
# NOTE: supabase/config.toml's project_id points at a different (old) project —
# never use it for the pooler username.
if [[ -z "${SUPABASE_URL:-}" ]]; then
  echo "ERROR: SUPABASE_URL is not set; cannot derive the project ref." >&2
  exit 2
fi
PROJECT_ID="$(echo "$SUPABASE_URL" | sed -E 's|^https?://([^./]+)\..*|\1|')"
if [[ -z "$PROJECT_ID" || "$PROJECT_ID" == "$SUPABASE_URL" ]]; then
  echo "ERROR: could not derive project ref from SUPABASE_URL" >&2
  exit 2
fi

DB_URL="postgresql://postgres.${PROJECT_ID}:${SUPABASE_DB_PASSWORD}@${POOLER_HOST}:${POOLER_PORT}/postgres"

TMP_OUT="$(mktemp /tmp/supabase-types-gen.XXXXXX.ts)"
TMP_ERR="$(mktemp /tmp/supabase-types-gen.XXXXXX.err)"
trap 'rm -f "$TMP_OUT" "$TMP_ERR"' EXIT

echo "Generating types from live Supabase DB (supabase CLI v${SUPABASE_CLI_VERSION})..."
if ! npx --yes "supabase@${SUPABASE_CLI_VERSION}" gen types typescript \
    --db-url "$DB_URL" \
    --schema public \
    > "$TMP_OUT" 2>"$TMP_ERR"; then
  echo "ERROR: supabase gen types failed:" >&2
  tail -20 "$TMP_ERR" >&2
  exit 2
fi

# Sanity check: refuse to treat an empty/garbage response as truth.
if ! grep -q "export type Database" "$TMP_OUT"; then
  echo "ERROR: generated output does not look like a Supabase types file:" >&2
  head -10 "$TMP_OUT" >&2
  exit 2
fi

if [[ "$MODE" == "write" ]]; then
  cp "$TMP_OUT" "$TYPES_FILE"
  echo "Wrote fresh types to $TYPES_FILE ($(wc -l < "$TYPES_FILE") lines)."
  exit 0
fi

if diff -q "$TYPES_FILE" "$TMP_OUT" > /dev/null; then
  echo "OK: $TYPES_FILE matches the live database schema."
  exit 0
fi

echo "" >&2
echo "DRIFT DETECTED: $TYPES_FILE is out of sync with the live Supabase database." >&2
echo "" >&2
# Show which tables were added/removed for a quick read on the damage.
extract_tables() {
  awk '/^    Tables: \{/{f=1;next} /^    Views: \{/{f=0} f && /^      [a-zA-Z_][a-zA-Z0-9_]*: \{/{gsub(/:/,"",$1); print $1}' "$1" | sort -u
}
LIVE_ONLY="$(comm -13 <(extract_tables "$TYPES_FILE") <(extract_tables "$TMP_OUT") || true)"
TYPED_ONLY="$(comm -23 <(extract_tables "$TYPES_FILE") <(extract_tables "$TMP_OUT") || true)"
[[ -n "$LIVE_ONLY" ]] && { echo "Tables in live DB but missing from types.ts:" >&2; echo "$LIVE_ONLY" | sed 's/^/  + /' >&2; }
[[ -n "$TYPED_ONLY" ]] && { echo "Tables in types.ts but not in live DB:" >&2; echo "$TYPED_ONLY" | sed 's/^/  - /' >&2; }
if [[ -z "$LIVE_ONLY" && -z "$TYPED_ONLY" ]]; then
  echo "(table list matches — drift is in columns, functions, enums, or views)" >&2
  diff -u "$TYPES_FILE" "$TMP_OUT" | head -60 >&2
fi
echo "" >&2
echo "Fix: bash scripts/check-supabase-types.sh --write   (then commit the result)" >&2
exit 1
