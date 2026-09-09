#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FIXTURE_ROOT=$(mktemp -d)
trap 'rm -rf "$FIXTURE_ROOT"' EXIT

mkdir -p "$FIXTURE_ROOT/artifacts/aurora-mobile"
cat > "$FIXTURE_ROOT/.easignore" <<'EOF'
/*
!/artifacts
!/artifacts/aurora-mobile
EOF

LOCK="$FIXTURE_ROOT/artifacts/aurora-mobile/package-lock.json"
cat > "$LOCK" <<'EOF'
{
  "name": "firewall-url-fixture",
  "lockfileVersion": 3,
  "packages": {
    "node_modules/plain": {
      "version": "1.2.3",
      "resolved": "http://package-firewall.replit.internal/npm/plain/-/plain-1.2.3.tgz",
      "integrity": "sha512-plain"
    },
    "node_modules/@scope/encoded": {
      "version": "4.5.6",
      "resolved": "https://package-firewall.replit.local/npm/%40scope%2fencoded/-/encoded-4.5.6.tgz",
      "integrity": "sha512-encoded"
    },
    "node_modules/@scope/unencoded": {
      "version": "7.8.9",
      "resolved": "http://package-firewall.replit.local/npm/@scope/unencoded/-/unencoded-7.8.9.tgz",
      "integrity": "sha512-unencoded"
    }
  }
}
EOF

EAS_PREFLIGHT_ROOT="$FIXTURE_ROOT" bash "$ROOT/scripts/eas-preflight.sh" >/dev/null

node - "$LOCK" <<'NODE'
const fs = require("fs");
const lock = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const packages = lock.packages;
const expected = {
  "node_modules/plain": {
    version: "1.2.3",
    resolved: "https://registry.npmjs.org/plain/-/plain-1.2.3.tgz",
    integrity: "sha512-plain",
  },
  "node_modules/@scope/encoded": {
    version: "4.5.6",
    resolved: "https://registry.npmjs.org/%40scope%2fencoded/-/encoded-4.5.6.tgz",
    integrity: "sha512-encoded",
  },
  "node_modules/@scope/unencoded": {
    version: "7.8.9",
    resolved: "https://registry.npmjs.org/@scope/unencoded/-/unencoded-7.8.9.tgz",
    integrity: "sha512-unencoded",
  },
};

for (const [name, values] of Object.entries(expected)) {
  for (const [field, value] of Object.entries(values)) {
    if (packages[name][field] !== value) {
      throw new Error(`${name}.${field}: expected ${value}, got ${packages[name][field]}`);
    }
  }
}
NODE

cat > "$LOCK" <<'EOF'
{
  "name": "unsupported-firewall-url-fixture",
  "lockfileVersion": 3,
  "packages": {
    "node_modules/plain": {
      "version": "1.2.3",
      "resolved": "http://package-firewall.replit.internal/other/plain-1.2.3.tgz",
      "integrity": "sha512-plain"
    }
  }
}
EOF

if EAS_PREFLIGHT_ROOT="$FIXTURE_ROOT" bash "$ROOT/scripts/eas-preflight.sh" >/dev/null 2>&1; then
  echo "expected unsupported firewall URL to fail preflight" >&2
  exit 1
fi

echo "eas-preflight regression: PASS"