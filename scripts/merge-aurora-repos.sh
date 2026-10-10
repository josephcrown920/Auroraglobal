#!/usr/bin/env bash
set -euo pipefail

# Clean merge plan for integrating:
# - josephcrown920/cosmic-aurora-play
# - josephcrown920/aurora-companion-hub
# into josephcrown920/Auroraglobal
#
# Usage:
#   bash scripts/merge-aurora-repos.sh
#
# Safety:
# - This keeps each repository under apps/<repo-name>/
# - It avoids destructive root-level merges
# - It preserves each repo's full Git history via git subtree

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

if ! git rev-parse --verify Main >/dev/null 2>&1; then
  echo "ERROR: Missing branch 'Main'."
  exit 1
fi

if ! git rev-parse --verify merge/aurora-repos >/dev/null 2>&1; then
  echo "ERROR: Missing branch 'merge/aurora-repos'."
  exit 1
fi

git checkout merge/aurora-repos

# Ensure directories exist for app subtrees.
mkdir -p apps

# Add cosmic-aurora-play as a subtree.
if ! git remote get-url cosmic-aurora-play >/dev/null 2>&1; then
  git remote add cosmic-aurora-play git@github.com:josephcrown920/cosmic-aurora-play.git
fi

git fetch cosmic-aurora-play main

# If the subtree already exists, skip it.
if [ ! -d "apps/cosmic-aurora-play" ]; then
  git subtree add \
    --prefix=apps/cosmic-aurora-play \
    cosmic-aurora-play main \
    --message="Merge cosmic-aurora-play into apps/"
fi

# Add aurora-companion-hub as a subtree.
if ! git remote get-url aurora-companion-hub >/dev/null 2>&1; then
  git remote add aurora-companion-hub git@github.com:josephcrown920/aurora-companion-hub.git
fi

git fetch aurora-companion-hub main

if [ ! -d "apps/aurora-companion-hub" ]; then
  git subtree add \
    --prefix=apps/aurora-companion-hub \
    aurora-companion-hub main \
    --message="Merge aurora-companion-hub into apps/"
fi

echo
echo "Review the result before pushing:"
echo "  git status"
echo "  git diff --stat"
echo "  git log --oneline --decorate -n 10"
echo

echo "Likely conflicts to inspect:"
echo "  - package.json"
echo "  - tsconfig.json"
echo "  - vite.config.ts"
echo "  - .env.example"
echo "  - bun.lock"
echo "  - src/"
echo "  - workers/"
echo "  - supabase/"
echo "  - scripts/"
echo

echo "When ready:"
echo "  git add ."
echo "  git commit -m \"Merge Aurora repos into apps/\""
echo "  git push origin merge/aurora-repos"
echo"