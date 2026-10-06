---
name: npx skills CLI update pitfall
description: The `skills` CLI has no `check` subcommand — it falls through to `update` and rewrites every installed skill; how its lock hash works.
---

**Rule:** never run a bare `npx skills check` or `npx skills update`; always name the skills
(`npx skills update <a> <b>`), and diff `skills-lock.json` + `git status .agents/skills` after
any skills-CLI command before moving on.

**Why:** `check` is not a subcommand — it falls through to `update`, which rewrote every installed
skill (deleting nested SKILL.md files, adding asset dirs) and re-hashed the whole lock. Recovery
means restoring `.agents/skills` + the lock from git with the intended new skill dirs excluded,
then re-running the targeted `add`.

**How to apply:** `--agent replit` targets `.agents/skills/`. `computedHash` is a sha256 over the
ENTIRE skill folder (sorted paths + contents), so pruning files a skill ships (some upstream repos
keep SKILL.md inside a whole source package) breaks parity with the lock — keep the folder intact.
