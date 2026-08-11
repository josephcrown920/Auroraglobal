#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
echo "Running post-create setup inside devcontainer..."

# Node install
if [ -f package-lock.json ]; then
  echo "Found package-lock.json — running npm ci"
  npm ci
elif [ -f pnpm-lock.yaml ]; then
  echo "Found pnpm-lock.yaml — running pnpm install"
  pnpm install || true
elif [ -f yarn.lock ]; then
  echo "Found yarn.lock — running yarn install"
  yarn install || true
else
  if [ -f package.json ]; then
    echo "No lockfile found — running npm install"
    npm install || true
  else
    echo "No package.json found — skipping JS install"
  fi
fi

# Python deps
if [ -f requirements.txt ]; then
  echo "Installing Python requirements"
  pip3 install --user -r requirements.txt || true
fi

# Optional: run any repo-specific setup script if present
if [ -x scripts/setup.sh ]; then
  echo "Running repo scripts/setup.sh"
  bash scripts/setup.sh || true
fi

echo "Post-create script finished."
