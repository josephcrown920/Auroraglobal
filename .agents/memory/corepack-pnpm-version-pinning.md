---
name: Corepack pnpm pinning is directory-scoped
description: corepack honors packageManager only for the cwd's project; bare `pnpm` inside package.json scripts fails in corepack-only environments — write scripts as `corepack pnpm`
---

Two corepack traps in this container (no `pnpm` shim on PATH):

1. **`packageManager` is directory-scoped.** `corepack pnpm` resolves the pin of the *current directory's* project: inside `.scaffold-backup` it runs 10.34.5 (pinned); at the repo root (no field) it silently runs latest (v11 as of 2026-09), which rejects lockfiles built on `package.json#pnpm.overrides` with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` (pnpm 11 moved overrides to `pnpm-workspace.yaml`).
2. **Bare `pnpm` inside package.json scripts is not self-contained.** A script like `orval ... && pnpm -w run typecheck:libs` fails with `pnpm: command not found` in a clean corepack-only env even when invoked via `corepack pnpm run codegen`. Use `corepack pnpm` in nested script calls.

**Why:** A completion code review rejected a "reproducible codegen" claim because the codegen's typecheck step died on bare `pnpm`; my earlier belief that "corepack ignores packageManager" was wrong — I had run it from the repo root, not the pinned directory.

**How to apply:** `cd` into the pinned project dir before any `corepack pnpm` command (verify with `corepack pnpm --version`), and write all nested package scripts with `corepack pnpm`. If upgrading a project to pnpm 11, migrate overrides into `pnpm-workspace.yaml` first.
