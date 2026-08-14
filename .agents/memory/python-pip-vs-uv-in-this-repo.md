---
name: Python installs — pip wrapper works, uv add does not
description: How to install Python packages in this repo; uv targets the read-only nix store and fails
---

The rule: install Python packages here with the environment's `pip` wrapper (it installs into `.pythonlibs/` correctly). Do NOT use `uv add` / `uv sync` — and expect the managed language-package installer (which drives uv) to fail the same way.

**Why:** `uv add` resolves fine but then tries to create directories under the nix-store base interpreter's `site-packages` (`/nix/store/…python3-3.11…/site-packages/…`) → `Permission denied`, because `.pythonlibs` is a prefix-style dir without `pyvenv.cfg`, so uv doesn't treat it as the target venv. The `pip` wrapper (`PIP_CONFIG_FILE`/`PIP_PREFIX` plumbing) targets `.pythonlibs` and works — verified 2026-08-14 installing comfy-cli 1.16.0.

**How to apply:** when a Python package is needed, try the managed installer once; if it fails opaquely, fall back to plain `pip install <pkg>` and verify the CLI/module from `.pythonlibs/bin`. Revert any half-applied `uv add` edit to `pyproject.toml` (uv writes the dep entry before installing), or future uv-driven syncs fail. Root `pyproject.toml` deliberately stays `dependencies = []` — Python tools here are CLI-style installs, not tracked project deps.
