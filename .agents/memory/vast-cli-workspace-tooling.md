---
name: Vast.ai CLI/SDK workspace tooling
description: Why the official vastai tools get their key through a usercustomize hook, and the read-only/2FA gotchas when verifying them.
---

**Rule:** the official `vastai` package is a pinned workspace tool in `.pythonlibs` (setup script
in scripts/), never a pyproject dependency. Its key comes from a `usercustomize.py` hook that maps
`VASTAI_API_KEY` → `VAST_API_KEY` in-process; do not add a second secret or a wrapper script.

**Why:** upstream only reads `VAST_API_KEY`; `.replit [env]` cannot interpolate one variable into
another; duplicating the secret is banned; a wrapper breaks "bare `vastai` / `VastAI()` just work".
`sitecustomize` is taken by the Nix Python (first on sys.path wins), so `usercustomize` is the slot.

**How to apply:**
- Prove mapping without exposure: run an account command with a FAKE `VASTAI_API_KEY` → "Invalid
  user key". A real-key 401 mentioning Two Factor Authentication = pre-2FA account key (offer
  search still works); it is an owner account action, not an install bug.
- `--raw` exits 0 on API errors (check the JSON `error` field); `--explain` prints the key.
- Read-only only; renting/stopping/destroying goes through the guarded `aurora vast …` flow.
