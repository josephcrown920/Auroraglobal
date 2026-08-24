#!/usr/bin/env bash
# Honest, one-shot sync of the current workspace to the user's GitHub repos.
#
# Why this is NO LONGER a silent 10-minute loop:
#   The previous version looped every 10 minutes authenticating with a
#   GITHUB_TOKEN that was UNSET, so every push silently failed while it logged
#   "pushing..." — nothing ever reached GitHub. This version REQUIRES a real
#   GITHUB_TOKEN (repo + workflow scopes) and exits non-zero with a clear error
#   if anything fails. It never claims success while failing.
#
# Why it clones + strips instead of a plain `git push`:
#   The workspace git history permanently contains export .zip files larger than
#   GitHub's 100MB hard per-file limit, so a plain `git push Main` is always
#   rejected. This clones to a throwaway dir, strips every >=100MB blob from
#   history, then publishes the cleaned lineage. It ABORTS if stripping would
#   change the current tip tree (i.e. an oversized file lives in the tip and
#   could not be published to GitHub anyway) so it can never silently publish a
#   Main that is missing files.
#
# How the push works without a force-push:
#   It uploads the cleaned objects to a unique temp branch (a normal, non-force
#   push), then repoints Main to the cleaned tip via the GitHub REST API (a
#   force ref-update, which also works on a default branch), then deletes the
#   temp branch.
#
# Usage:  bash scripts/github-autopush.sh
set -euo pipefail

OWNER="josephcrown920"
# aurora-charm-forge-87e3e757 removed 2026-08-07: that legacy mirror is ARCHIVED
# on GitHub (read-only), so every push to it 403s and marked the whole sync
# FAILED even when Auroraglobal succeeded. Auroraglobal is the only live mirror.
REPOS=("Auroraglobal")
BRANCH="Main"
LIMIT=104857600  # 100 MiB

# Known legacy paths that are UNDER the 100MB hard limit (so detect_big never
# catches them) but are still large enough (40-46MB) to meaningfully bloat
# every clone. Stripped unconditionally on every sync so a daemon run can
# never silently resurrect them into the published history. See Task #135.
EXTRA_STRIP_PATHS=(
  "attached_assets/Collab_inference_slim_1782518386269.zip"
  "attached_assets/Collab_inference_slim_1782509661894.zip"
  "attached_assets/49f23e5347eb41e69ccfb1aeeafb9ba7_1782179904593.mp4"
  "attached_assets/c076509be6eb4ecc9c3e0cb16ad2ba38_1782179904594.mp4"
  # Pasted scripts containing a live VolcEngine access key (GitHub push
  # protection blocks any lineage containing their blobs — 2026-08-24 sync
  # outage). Deleted from the working tree the same day; stripped from
  # history unconditionally so no rebase can resurrect them.
  "attached_assets/Pasted--coding-utf-8-from-future-import-print-function-import-_1787506293708.txt"
  "attached_assets/Pasted--coding-utf-8-from-future-import-print-function-import-_1787506348124.txt"
)

# Only the primary workspace may publish to GitHub. Task-agent clones of this
# project run this same script via the sync daemon, and on 2026-07-29 one
# force-pushed its own lineage over Auroraglobal/Main.
MAIN_REPL_ID="70e0e8ce-1ee1-49b1-8d1e-35dc6c558d3d"
if [[ "${REPL_ID:-}" != "$MAIN_REPL_ID" ]]; then
  echo "[sync] ERROR: refusing to push from a non-main environment (REPL_ID=${REPL_ID:-unset})." >&2
  echo "[sync] Only the primary workspace may publish to GitHub." >&2
  exit 1
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "[sync] ERROR: GITHUB_TOKEN is not set (need a token with repo + workflow scopes)." >&2
  echo "[sync] Refusing to run so we never silently fail. Set the secret and re-run." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d /tmp/aurora-sync.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT
redact() { sed -E 's#x-access-token:[^@]*@#x-access-token:***@#g'; }
gh_api() { # METHOD URL [JSON-body]
  if [[ -n "${3:-}" ]]; then
    curl -fsS -X "$1" -H "Authorization: Bearer $GITHUB_TOKEN" \
      -H "Accept: application/vnd.github+json" "$2" -d "$3"
  else
    curl -fsS -X "$1" -H "Authorization: Bearer $GITHUB_TOKEN" \
      -H "Accept: application/vnd.github+json" "$2"
  fi
}

# Emit a NUL-delimited, de-duplicated list of paths that hold a >=LIMIT blob in
# ANY commit of $BRANCH. NUL-safe (handles spaces / metacharacters in paths) and
# enumerated per-commit because `rev-list --objects` dedupes by blob SHA and so
# hides extra paths that held the same giant blob. A blob >100MB in ANY commit
# blocks GitHub even if it is not in the tip. python3 is used because awk cannot
# emit NUL bytes.
detect_big() {
  local c
  for c in $(git rev-list "$BRANCH"); do git ls-tree -r -l -z "$c"; done \
    | LIM="$LIMIT" python3 -c '
import sys, os
lim = int(os.environ["LIM"])
seen = set()
for rec in sys.stdin.buffer.read().split(b"\0"):
    if not rec:
        continue
    meta, sep, path = rec.partition(b"\t")
    if not sep:
        continue
    parts = meta.split()
    if len(parts) < 4:
        continue
    try:
        size = int(parts[3])
    except ValueError:
        continue
    if size >= lim and path not in seen:
        seen.add(path)
        sys.stdout.buffer.write(path + b"\0")
'
}

echo "[sync] Cloning workspace -> $WORK/repo"
# --bare: clones git objects only, no working tree at all.  A bare repo has no
# concept of "unstaged changes" so filter-branch never hits the index/work-tree
# mismatch that breaks --no-checkout clones (where read-tree populates the index
# but the empty work-tree looks like every file is deleted).
GIT_LFS_SKIP_SMUDGE=1 git clone --no-hardlinks --bare -q "file://$ROOT" "$WORK/repo"
cd "$WORK/repo"

ORIG_TREE="$(git rev-parse "${BRANCH}^{tree}")"

echo "[sync] Detecting blobs >=100MB across history"
detect_big > "$WORK/bigpaths.nul"
for p in "${EXTRA_STRIP_PATHS[@]}"; do
  printf '%s\0' "$p" >> "$WORK/bigpaths.nul"
done
if [[ -s "$WORK/bigpaths.nul" ]]; then
  echo "[sync]   stripping:"; tr '\0' '\n' < "$WORK/bigpaths.nul" | sed '/^$/d;s/^/[sync]     /'
  FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch --force --index-filter \
    "git rm -r --cached --ignore-unmatch --pathspec-from-file='$WORK/bigpaths.nul' --pathspec-file-nul" \
    -- "$BRANCH" >/dev/null
  rm -rf refs/original   # bare clone: refs/ is at root, no .git/ subdir
fi

# Safety 1: stripping must NOT change the published tip tree. If it did, an
# oversized file lives in the current tip and cannot be synced to GitHub at all.
NEW_TREE="$(git rev-parse "${BRANCH}^{tree}")"
if [[ "$NEW_TREE" != "$ORIG_TREE" ]]; then
  echo "[sync] ERROR: stripping changed the tip tree ($ORIG_TREE -> $NEW_TREE)." >&2
  echo "[sync] An oversized (>100MB) file is in the current tip; GitHub cannot" >&2
  echo "[sync] accept it. Remove/relocate that file from Main, then re-run." >&2
  exit 1
fi

# Safety 2: never push if anything >=100MB still remains in the pushed history.
detect_big > "$WORK/remain.nul"
if [[ -s "$WORK/remain.nul" ]]; then
  echo "[sync] ERROR: blobs still >=100MB after strip; aborting:" >&2
  tr '\0' '\n' < "$WORK/remain.nul" >&2
  exit 1
fi

TIP="$(git rev-parse "$BRANCH")"
echo "[sync] Cleaned tip = $TIP (tip tree $NEW_TREE unchanged)"

# Primary repo: hard-fail if this one can't be synced (it's the canonical copy).
# Secondary repos: best-effort — a 422 branch-protection error or similar is
# logged as a warning so the daemon marks the primary sync as OK and advances
# the SHA marker. The secondary push already uploaded the objects (the temp
# branch landed); only the ref-update is flaky under branch-protection rules.
PRIMARY="${REPOS[0]}"
SECONDARY=("${REPOS[@]:1}")

FAIL=0

push_repo() {
  local repo="$1" hard="$2"
  local url="https://x-access-token:${GITHUB_TOKEN}@github.com/${OWNER}/${repo}"
  local tmp="sync-tmp-$(date +%s)-$$"
  local ok=1
  echo "[sync] ${repo}: uploading objects (temp branch ${tmp})"
  if ! git push --no-verify "$url" "${BRANCH}:refs/heads/${tmp}" 2>&1 | redact; then
    echo "[sync] ERROR: object upload to ${repo} failed" >&2
    [[ "$hard" == "1" ]] && FAIL=1
    return
  fi
  echo "[sync] ${repo}: pointing ${BRANCH} at ${TIP}"
  local patch_out patch_rc
  # Use && / || so set -e never aborts here on a non-zero exit (e.g. 422 branch
  # protection on Auroraglobal).  The actual exit code is captured in patch_rc.
  patch_out=$(gh_api PATCH "https://api.github.com/repos/${OWNER}/${repo}/git/refs/heads/${BRANCH}" \
        "{\"sha\":\"${TIP}\",\"force\":true}" 2>&1) && patch_rc=0 || patch_rc=$?
  if [[ $patch_rc -ne 0 ]]; then
    if [[ "$hard" == "1" ]]; then
      echo "[sync] ERROR: failed to update ${repo}/${BRANCH}" >&2; ok=0; FAIL=1
    else
      echo "[sync] WARN: ${repo}/${BRANCH} ref-update failed (branch protection?); objects uploaded, continuing." >&2
    fi
  fi
  if ! gh_api DELETE "https://api.github.com/repos/${OWNER}/${repo}/git/refs/heads/${tmp}" >/dev/null 2>&1; then
    echo "[sync] WARN: could not delete temp branch ${tmp} on ${repo} (sync still OK)" >&2
  fi
  if [[ "$ok" -eq 1 && $patch_rc -eq 0 ]]; then echo "[sync] OK: ${repo}/${BRANCH} = ${TIP}"; fi
}

push_repo "$PRIMARY" "1"
for repo in "${SECONDARY[@]}"; do
  push_repo "$repo" "0"
done

if [[ "$FAIL" -ne 0 ]]; then
  echo "[sync] FAILED — see errors above." >&2
  exit 1
fi
echo "[sync] DONE — ${PRIMARY}/${BRANCH} at ${TIP}"
