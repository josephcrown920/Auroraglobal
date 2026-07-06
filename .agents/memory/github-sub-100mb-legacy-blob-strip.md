---
name: Sub-100MB legacy blob stripping must be hardcoded, not size-detected
description: Why known 40-46MB legacy files need a permanent explicit strip list in github-autopush.sh, and how to find every path variant that ever held them.
---

The GitHub auto-sync daemon's `scripts/github-autopush.sh` only strips blobs
`>=100MB` (GitHub's hard limit forces that). Any known-oversized-but-under-100MB
legacy file (e.g. old 40-46MB media exports) will NOT be caught by that
size-based detection, and since the sync recipe never rewrites the live
workspace's own Main history (only a throwaway clone), the local Main branch
still contains the full-size blob forever. That means every future daemon run
starts from the same unstripped local history and would silently resurrect
the file into GitHub the moment it force-pushes again — a one-time manual
`filter-branch` fix does NOT stick.

**Fix:** add an explicit, hardcoded `EXTRA_STRIP_PATHS` array to
`github-autopush.sh` for known legacy files under the size threshold,
stripped unconditionally on every sync regardless of size. Don't rely on
lowering `LIMIT`— that's scope creep into "prevent future bloat" behavior
(a separate concern) and could unexpectedly strip legitimate new media.

**Finding every path variant:** the same file content can be re-saved under
multiple timestamped filenames (Replit's upload naming). `git rev-list
--objects` dedupes by blob SHA and will only show ONE of the duplicate
paths. Always enumerate via per-commit `git ls-tree -r -l <commit>` across
`git rev-list <branch>` to catch every path that ever held a matching blob
size — this is the only reliable method (documented in
`github-origin-sync.md` as the "blob-dedup trap", confirmed again here: a
task description named one `Collab_inference_slim_*.zip` timestamp but a
second identical-content duplicate under a different timestamp also existed
on Main and would have been missed by the naive check).

**Also verify the named files actually exist on the branch in scope.** A
task description's filenames can be stale/typo'd (e.g. a hash suffix off by
one character) or describe files that only exist on unpublished side
branches (`subrepl-*`, old session branches) rather than the branch actually
pushed to GitHub. Always confirm exact path + branch membership via
`git rev-list --objects --all | grep <partial-hash>` before assuming the
task's literal file list is authoritative.
