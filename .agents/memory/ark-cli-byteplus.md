---
name: Ark CLI (BytePlus) on Replit
description: How the BytePlus Ark CLI is installed/persisted here and its auth quirks.
---

The BytePlus Ark CLI (`@byteplus/ark-cli`) lives at `.local/ark-cli/` (git-ignored); run it via the wrapper `.local/ark-cli/arkcli`.

**Why:** `npm i -g` fails (read-only nix prefix) and everything outside `/home/runner/workspace` is wiped on container restarts — a home-dir install literally vanished mid-session (2026-08-24). The CLI stores credentials in `~/.arkcli-bp/`, so login would be lost too.

**How to apply:**
- The wrapper re-creates the `~/.arkcli-bp → .local/ark-cli/state` symlink if missing and exports `ARK_API_KEY` from `BYTEPLUS_API_KEY`; always use it, never the bare binary.
- Login is the two-phase no-browser SSO flow: `arkcli auth login --no-browser` → send `authorize_url` to the user (links expire in 10 min; render as a clickable markdown link — raw URLs may not display on mobile) → `arkcli auth login --no-browser --code <base64>`. Account is logged in as root (acct 3003324153, region ap-southeast-1).
- API key alone (no SSO) only covers data-plane calls and requires an `ep-...` endpoint id for chat — plain model slugs are rejected; control-plane (endpoints, billing, key listing) needs the SSO profile.
- Its npm postinstall auto-injects "skills" into `~/.agents/skills/arkcli-*` for detected agents (cline) — ephemeral, reinstalled by `arkcli +connect`.
