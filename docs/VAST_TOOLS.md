# Vast.ai CLI & Python SDK (workspace tooling)

The official Vast.ai tools are installed in this workspace so the owner and
agents can inspect the GPU marketplace and the account from the shell or from
Python. This is separate from — and does **not** replace — Aurora's managed
lifecycle (`aurora vast search|up|status|adopt|stop|destroy`, see
`cli/README.md`) and the server-side adapter in `src/lib/vast-api.server.ts`.

## What is installed

| Piece | Where | Notes |
|---|---|---|
| PyPI package `vastai` (CLI **and** SDK) | `.pythonlibs/` (persistent, git-ignored) | `vastai-sdk` is a deprecated alias of the same package |
| `vastai` executable | `.pythonlibs/bin/vastai` (already on `PATH`) | `vastai --version` |
| API-key hook `usercustomize.py` | `.pythonlibs/lib/python3.11/site-packages/` | copied from `scripts/vast-usercustomize.py`; maps `VASTAI_API_KEY` → `VAST_API_KEY` in-process |
| Agent skills `vastai` + `vastai-sdk` | `.agents/skills/`, pinned in `skills-lock.json` | official `vast-ai/vast-cli` skills, installed with `npx skills add vast-ai/vast-cli` |

Install or repair everything with one idempotent command (it also removes the
old `uv tool` copy and re-installs the key hook). The script pins the verified
release (currently **1.6.0**) so a reinstall reproduces the same toolchain;
upgrading is a deliberate step:

```bash
bash scripts/setup-vast-tools.sh                         # pinned, verified release
VASTAI_VERSION=latest bash scripts/setup-vast-tools.sh   # newest on PyPI — then re-run the read-only checks below and bump the pin in the script
VASTAI_VERSION=1.7.0 bash scripts/setup-vast-tools.sh    # a specific other release
```

Use the workspace `pip` wrapper for Python tools here — `uv add` targets the
read-only Nix site-packages and fails. Root `pyproject.toml` intentionally
keeps `dependencies = []`; `vastai` is a CLI-style install, not a project dep.

## Authentication — `VASTAI_API_KEY`

Aurora stores the Vast key as the **`VASTAI_API_KEY`** secret. The upstream
tools only look for `VAST_API_KEY` (or a key file written by
`vastai set api-key`). The `usercustomize.py` hook bridges the two names inside
each Python process, so both tools pick the key up automatically:

```bash
vastai --version
vastai search offers 'gpu_ram>=16 rentable=true' --limit 5 --raw
vastai show user --raw          # read-only: account + balance (needs a post-2FA key, see below)
```

```python
from vastai import VastAI

vast = VastAI()                 # key comes from the hook; VastAI(api_key=...) also works
offers = vast.search_offers(query="gpu_ram>=16 rentable=true", limit=5)
for o in offers:
    print(o["id"], o["gpu_name"], o["dph_total"])
```

An explicitly exported `VAST_API_KEY` always wins over the hook. Scope of the
hook: it runs in **every** Python process started from this workspace (repo
scripts, pip, …) and child processes inherit the extra variable — the same
value was already ambient as `VASTAI_API_KEY`, so nothing new is stored, but
don't dump `os.environ` in logs. With `--raw` the CLI exits 0 even when Vast
returns an error — scripts must check the JSON for `"error": true` instead of
relying on the exit code.

Never run `vastai set api-key` (copies the secret to disk), never `echo` the
key, never pass `--explain` (it prints the outgoing request including the API
key), and never commit a `vast_api_key` file.

## Guardrails — read-only from here

Everything above is read-only and safe. Renting, starting, stopping, or
destroying instances from this raw CLI/SDK starts real billing **outside**
Aurora's server-side guardrails (the $0.35/h ceiling, the 1-hour auto-destroy,
the confirm-token flow). For GPU workers use the managed flow instead:

```bash
aurora vast search --min-vram 16
aurora vast up --offer <id> --price <usd/h> --token <token-from-search>
aurora vast status
```

Agents working in this workspace must not run `vastai create|launch|start|
stop|destroy|recycle instance`, `vastai delete ...`, or the SDK equivalents
unless the owner explicitly asks for that specific operation.

## Known account caveat: 2FA

Vast returns `401 … requires … Two Factor Authentication` for instance/account
operations (`show user`, `show instances`, …) when the API key was created
**before** 2FA was enabled on the Vast account. Offer search still works. As of
2026-09-04 the `VASTAI_API_KEY` secret behaved like such a key (search OK,
`show user` → 2FA 401); re-check after any key rotation. Fix on the Vast side:
enable 2FA, generate a new key, update the `VASTAI_API_KEY` secret. This is an
account setting, not an install problem.

## Updating / removing

```bash
bash scripts/setup-vast-tools.sh                         # reinstall/repair the pinned CLI + SDK, refresh the hook
VASTAI_VERSION=latest bash scripts/setup-vast-tools.sh   # upgrade (then bump the pin in the script)
npx skills update vastai vastai-sdk                      # refresh ONLY these two skills + their lock entries
pip uninstall vastai                                     # remove the CLI + SDK
rm .pythonlibs/lib/python3.11/site-packages/usercustomize.py   # remove the key hook
```

Always name the skills when updating: a bare `npx skills update` (and `npx
skills check`, which is not a real subcommand and falls through to update)
rewrites every installed skill in `.agents/skills/` and the whole lock file.
