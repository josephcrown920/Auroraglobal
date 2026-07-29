---
name: GitHub auto-sync daemon (keeps origin from drifting)
description: A polling background workflow, not a git hook, keeps GitHub in sync with every Replit commit — read this before re-solving "GitHub is behind again".
---

Auto-sync to GitHub is implemented as a **polling background workflow** (`github-sync`, running `scripts/github-sync-daemon.sh`), not a git post-commit hook.

**Why not a hook:** `.git/hooks/*` only fire on porcelain `git commit`/`git merge`/`git push`. Whether Replit's checkpoint mechanism goes through porcelain or plumbing (e.g. `commit-tree` + `update-ref`) is unverified and could change; a hook is a bet that isn't worth taking when a cheap poll is just as fast in practice (the task description itself green-lit "on a schedule" as an acceptable design).

**How it works:** the daemon loops every 30s, compares `git rev-parse Main` to a locally-stored last-synced SHA (`.local/.github-sync-last-sha`, untracked/gitignored — this state is intentionally NOT meant to survive a fresh clone, only this container), and on change runs the existing `scripts/github-autopush.sh` (clone + strip >100MB blobs + force-push via temp branch + REST ref update — see `github-origin-sync.md` for why that dance is necessary). It only writes the new SHA to the state file on success, so a failed push is retried next cycle instead of being silently marked done. If `GITHUB_TOKEN` is unset it logs a warning and skips (never crashes the loop).

**Scope limit:** the daemon only runs while the workspace's `Project` run-workflow is active (it's wired in as one of `Project`'s parallel tasks so it auto-starts on workspace boot). Nothing runs while the container is fully stopped — there's no serverless/cron primitive available to this agent for a stopped workspace. This is a platform ceiling, not a gap in the daemon logic itself.

**Caveat:** each sync re-clones and re-runs `filter-branch` over full history rather than incrementally pushing — acceptable at current repo size/frequency, but if the repo grows much larger or commits land very frequently, revisit for a lighter incremental push path.

**Use `--bare`, not `--no-checkout`:** `--bare` is the correct flag. `--no-checkout` has a fatal interaction with `git filter-branch`: even after `git read-tree HEAD` populates the index, the empty working tree makes git report "You have unstaged changes" (every tracked file looks deleted) and filter-branch refuses. A bare clone has no working tree concept at all, so filter-branch never performs that check. Also: bare repos have `refs/original/` at the repo root (no `.git/` subdir), so cleanup is `rm -rf refs/original` not `rm -rf .git/refs/original`. Current script (`scripts/github-autopush.sh`) already uses `--bare` and the corrected cleanup path.

**State file must actually be gitignored:** `*.local` glob-matches files literally named `.local` too, but don't rely on that alone — a dedicated `.local/` line in `.gitignore` makes the intent explicit and is verifiable with `git check-ignore -v <path>`.
